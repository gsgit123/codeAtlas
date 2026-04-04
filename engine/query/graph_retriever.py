import os
from neo4j import GraphDatabase
from dotenv import load_dotenv
load_dotenv()
driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USERNAME", "neo4j"), os.getenv("NEO4J_PASSWORD"))
)


##impact

def impact_query(project_id:str,file_name:str)->dict:
    with driver.session() as session:
        result = session.run("""
            MATCH path = (dep:File {project_id: $pid})-[:IMPORTS*1..10]->(target:File {project_id: $pid})
            WHERE target.path CONTAINS $file_name
            RETURN dep.path AS affected_file, length(path) AS distance
            ORDER BY distance
        """, pid=project_id, file_name=file_name)


        affected = [{"file": r["affected_file"], "distance": r["distance"]} for r in result]

    context=f"Impact Analysis: If '{file_name}' is changed, {len(affected)} file(s) are affected:\n"
    for a in affected:
        context += f"  - {a['file']} (distance: {a['distance']} hops)\n"
    return {"type":"impact","affected_files":affected,"context":context}


##trace

def trace_query(project_id:str,start_file:str,end_file:str)->dict:

    with driver.session() as session:
        result = session.run("""
            MATCH path = shortestPath(
                (a:File {project_id: $pid})-[:IMPORTS*]->(b:File {project_id: $pid})
            )
            WHERE a.path CONTAINS $start AND b.path CONTAINS $end
            RETURN [node IN nodes(path) | node.path] AS path_nodes
        """, pid=project_id, start=start_file, end=end_file)

        record = result.single()
        path_nodes = record["path_nodes"] if record else []


    if path_nodes:
        context = f"Trace: The dependency path from '{start_file}' to '{end_file}':\n"
        for i, node in enumerate(path_nodes):
            context += f"  {'→ ' * i}{node}\n"
    else:
        context = f"No direct import path found between '{start_file}' and '{end_file}'."
    return {"type": "trace", "path": path_nodes, "context": context}

##structural

def structural_query(project_id:str)->dict:
    with driver.session() as session:
        hubs_result = session.run("""
            MATCH (f:File {project_id: $pid, is_hub: true})
            RETURN f.path AS file, f.in_degree AS in_degree, f.topo_order AS topo_order
            ORDER BY f.in_degree DESC
        """, pid=project_id)
        hubs = [{"file": r["file"], "in_degree": r["in_degree"], "topo_order": r["topo_order"]} for r in hubs_result]

        cycles_result = session.run("""
            MATCH (f:File {project_id: $pid, has_cycle: true})
            RETURN f.path AS file
        """, pid=project_id)
        cyclic_files = [r["file"] for r in cycles_result]
        # Total file count
        count_result = session.run("""
            MATCH (f:File {project_id: $pid})
            RETURN count(f) AS total
        """, pid=project_id)
        total = count_result.single()["total"]

    context = f"Structural Analysis ({total} total files):\n"
    context += f"Hub Files (most critical):\n"
    for h in hubs:
        context += f"  - {h['file']} (imported by {h['in_degree']} files)\n"
    if cyclic_files:
        context += f"Circular Import Issues: {', '.join(cyclic_files)}\n"
    else:
        context += "No circular imports detected.\n"
    return {"type": "structural", "hubs": hubs, "cyclic_files": cyclic_files, "context": context}