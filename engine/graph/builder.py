import os
from .dependency_graph import DependencyGraph
import re

def resolve_import_path(import_str: str, from_file: str, all_paths: set) -> str | None:
    """Try to find which real file an import string refers to."""
    # Extract the module path from the raw import string
    # Handle: import x from "path", import "path", require("path")
    match = re.search(r'from\s+["\']([^"\']+)["\']', import_str)
    if not match:
        match = re.search(r'require\s*\(\s*["\']([^"\']+)["\']\s*\)', import_str)
    if not match:
        match = re.search(r'import\s+["\']([^"\']+)["\']', import_str)
    if not match:
        return None

    raw_path = match.group(1)

    # Skip node_modules / bare package names (no relative path prefix)
    if not raw_path.startswith('.'):
        return None

    # Resolve the relative path against the importing file's directory
    from_dir = os.path.dirname(from_file)
    resolved = os.path.normpath(os.path.join(from_dir, raw_path))

    # Try with various extensions
    candidates = [
        resolved,
        resolved + '.js',
        resolved + '.jsx',
        resolved + '.ts',
        resolved + '.tsx',
        os.path.join(resolved, 'index.js'),
        os.path.join(resolved, 'index.jsx'),
    ]
    for c in candidates:
        if c in all_paths:
            return c

    return None


def build_project_graph(parsed_files: list) -> DependencyGraph:
    graph = DependencyGraph()
    all_paths = set()

    # First pass: register all nodes
    for f in parsed_files:
        abs_path = f["file"]
        all_paths.add(abs_path)
        metadata = {
            "language":       f.get("language", "unknown"),
            "function_count": len(f.get("functions", []))
        }
        graph.add_node(abs_path, metadata)

    # Second pass: resolve imports → edges
    for f in parsed_files:
        from_node = f["file"]
        for imp in f.get("imports", []):
            to_node = resolve_import_path(imp, from_node, all_paths)
            if to_node and to_node != from_node:
                graph.add_edge(from_node, to_node)

    print("Running Cycle Detection...")
    graph.detect_cycles()

    print("Running Topological Sort...")
    graph.topological_sort()

    print("Calculating Graph Hubs...")
    graph.calculate_hubs()

    return graph

