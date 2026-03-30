import tree_sitter_python as ts_py
from tree_sitter import Language, Parser

PY_LANG = Language(ts_py.language())
parser = Parser(PY_LANG)

def parse_python(file_content: bytes, file_path: str):
    tree = parser.parse(file_content)
    root_node = tree.root_node
    
    functions = []
    imports = []

    def traverse(node):
        if node.type in ['import_statement', 'import_from_statement']:
            imports.append(file_content[node.start_byte:node.end_byte].decode('utf8'))
            
        if node.type == 'function_definition':
            name_node = node.child_by_field_name('name')
            func_name = file_content[name_node.start_byte:name_node.end_byte].decode('utf8') if name_node else "anonymous"
            
            functions.append({
                "name": func_name,
                "start_line": node.start_point[0] + 1,
                "end_line": node.end_point[0] + 1,
                "code": file_content[node.start_byte:node.end_byte].decode('utf8')
            })
            
        for child in node.children:
            traverse(child)

    traverse(root_node)
    
    return {
        "file": file_path,
        "language": "python",
        "imports": imports,
        "functions": functions
    }
