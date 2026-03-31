import os
from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

class Neo4jClient:
    def __init__(self):
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USERNAME", "neo4j")
        password = os.getenv("NEO4J_PASSWORD")

        if not uri or not password:
            print("NEO4J credentials missing in engine/.env")
            self.driver=None
        else:
            self.driver=GraphDatabase.driver(uri,auth=(user,password))
    
    def close(self):
        if self.driver:
            self.driver.close()

    def store_project_graph(self,project_id:str,graph_data):
        if not self.driver:
            raise Exception("Cannot push to Neo4j. Database Driver not initialized check your .env file.")
        with self.driver.session() as session:
            for file_path,meta in graph_data.nodes.items():
                session.execute_write(self._merge_file_node,project_id,file_path,meta)
            for from_file, imported_files in graph_data.adj.items():
                for to_file in imported_files:
                    session.execute_write(self._merge_import_edge, project_id, from_file, to_file)
            print(f"Graph for project {project_id} successfully stored in Neo4j!")
    
    @staticmethod
    def _merge_file_node(tx,project_id,file_path,meta):
        query = """
        MERGE (f:File {path: $path, project_id: $pid})
        SET f.language = $lang,
            f.has_cycle = $has_cycle,
            f.topo_order = $topo_order,
            f.in_degree = $in_degree,
            f.is_hub = $is_hub,
            f.function_count = $function_count
        """
        tx.run(query, 
               path=file_path, 
               pid=project_id, 
               lang=meta.get("language", "unknown"),
               has_cycle=meta.get("has_cycle", False),
               topo_order=meta.get("topo_order", 0),
               in_degree=meta.get("in_degree", 0),
               is_hub=meta.get("is_hub", False),
               function_count=meta.get("function_count", 0))
    

    @staticmethod
    def _merge_import_edge(tx, project_id, from_file, to_file):
        query = """
        MATCH (a:File {path: $from_path, project_id: $pid})
        MATCH (b:File {path: $to_path, project_id: $pid})
        MERGE (a)-[:IMPORTS]->(b)
        """
        tx.run(query, from_path=from_file, to_path=to_file, pid=project_id)