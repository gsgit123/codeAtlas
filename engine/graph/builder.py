import os
from .dependency_graph import DependencyGraph

def build_project_graph(parsed_files:list)->DependencyGraph:
    graph=DependencyGraph()
    file_map={}

    #nodes
    for f in parsed_files:
        abs_path=f["file"]
        metadata={
            "language":f.get("language","unknown"),
            "function_count":len(f.get("functions",[]))
        }
        graph.add_node(abs_path,metadata)

        basename=os.path.basename(abs_path).split('.')[0]
        file_map[basename]=abs_path
    
    #edges imports
    for f in parsed_files:
        from_node=f["file"]
        imports=f.get("imports",[])

        for imp in imports:
            imp_clean = imp.replace("import ", "").replace("from ", "")
            imp_clean = imp_clean.split(";")[-1].strip(" '\"")
            imp_clean = imp_clean.split("/")[-1]
            imp_clean = imp_clean.split(".")[0]


            if imp_clean in file_map:
                to_node=file_map[imp_clean]
                if from_node !=to_node:
                    graph.add_edge(from_node,to_node)
    print("Running Cycle Detection...")
    graph.detect_cycles()
    
    print("Running Topological Sort...")
    graph.topological_sort()
    
    print("Calculating Graph Hubs...")
    graph.calculate_hubs()

    return graph

    

