from sre_parse import CATEGORIES
from collections import deque
import copy

class DependencyGraph:
    def __init__(self):
        self.adj={}
        self.radj={}
        self.nodes={}


    def add_node(self,name:str,metadata:dict=None):
        if name not in self.nodes:
            self.nodes[name]=metadata or {}
            self.adj[name]=[]
            self.radj[name]=[]
    def add_edge(self,u:str,v:str):
        self.add_node(u)
        self.add_node(v)
        if v not in self.adj[u]:
            self.adj[u].append(v)
        if u not in self.radj[v]:
            self.radj[v].append(u)
    #bfs
    def get_impact_zone(self,start_file:str)->list:
        if start_file not in self.radj:
            return[]
        visited=set()
        queue=deque([start_file,0])
        impact=[]
        while queue:
            current,dist=queue.popleft()
            if current in visited:
                continue
            visited.add(current)
            if current!=start_file:
                impact.append({
                    "file":current,
                    "distance":dist,
                })
            for neighbor in self.radj[current]:
                if neighbor not in visited:
                    queue.append([neighbor,dist+1])
        return sorted(impact,key=lambda x:x["distance"])

    #dfs
    def find_all_paths(self,start:str,end:str,path=None,visited=None)->list:
        if path is None:
            path=[]
        if visited is None:
            visited=set()
        
        path=path+[start]
        visited=visited|[start]

        if start==end:
            return [path]
        path=[]
        for neighbour in self.adj.get(start,[]):
            if neighbour not in visited:
                new_paths=self.find_all_paths(neighbour,end,path,visited)
                paths.extend(new_paths)
        return paths

    #cycles
    def detect_cycles(self) -> list:
        WHITE, GREY, BLACK = 0, 1, 2
        colors = {node: WHITE for node in self.nodes}
        cycles = []
        
        def dfs(node, path):
            colors[node] = GREY
            path.append(node)
            
            for neighbor in self.adj[node]:
                if colors[neighbor] == GREY:
                    cycle_start = path.index(neighbor)
                    cycles.append(path[cycle_start:] + [neighbor])
                elif colors[neighbor] == WHITE:
                    dfs(neighbor, path)
            
            colors[node] = BLACK
            path.pop()
        for node in self.nodes:
            if colors[node] == WHITE:
                dfs(node, [])
                
        cycle_nodes = set(n for cycle in cycles for n in cycle)
        for node in self.nodes:
            self.nodes[node]["has_cycle"] = node in cycle_nodes
            
        return cycles

    #topo sort
    def topological_sort(self) -> list:
        in_degree = {n: 0 for n in self.nodes}
        for u in self.adj:
            for v in self.adj[u]:
                in_degree[v] += 1
                
        queue = deque([n for n in self.nodes if in_degree[n] == 0])
        topo_order = []
        
        while queue:
            node = queue.popleft()
            topo_order.append(node)
            self.nodes[node]["topo_order"] = len(topo_order)
            
            for neighbor in self.adj[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
                    
        return topo_order

    #hub detection
    def calculate_hubs(self, top_k=5):
        for node in self.nodes:
            self.nodes[node]["in_degree"] = len(self.radj[node])
            self.nodes[node]["is_hub"] = False
            
        sorted_nodes = sorted(self.nodes.items(), key=lambda x: x[1]["in_degree"], reverse=True)
        
        hubs_found = 0
        for node, meta in sorted_nodes:
            if meta["in_degree"] > 0 and hubs_found < top_k:
                self.nodes[node]["is_hub"] = True
                hubs_found += 1
