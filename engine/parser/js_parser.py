import tree_sitter_javascript as ts_js
from tree_sitter import Language, Parser

JS_LANG=Language(ts_js.language())
parser=Parser(JS_LANG)

def parse_javascript(file_content:bytes,file_path:str):
    tree=parser.parse(file_content)
    root_node=tree.root_node

    functions=[]
    imports=[]

    def traverse(node):
        # ES6: import x from 'y'
        if node.type=="import_statement":
            imports.append(file_content[node.start_byte:node.end_byte].decode('utf8'))

        # CommonJS: require('y') or const x = require('y')
        if node.type == "call_expression":
            fn_node = node.child_by_field_name("function")
            if fn_node and file_content[fn_node.start_byte:fn_node.end_byte].decode('utf8') == "require":
                args_node = node.child_by_field_name("arguments")
                if args_node:
                    raw = file_content[node.start_byte:node.end_byte].decode('utf8')
                    imports.append(raw)

        if node.type in ['function_declaration','arrow_function','method_definition']:
            name_node=node.child_by_field_name('name')
            func_name=file_content[name_node.start_byte:name_node.end_byte].decode('utf8') if name_node else "anonymous"

            functions.append({
                "name":func_name,
                "start_line":node.start_point[0]+1,
                "end_line":node.end_point[0]+1,
                "code":file_content[node.start_byte:node.end_byte].decode('utf8')
            })

        for child in node.children:
                traverse(child)
    traverse(root_node)

    return {
        "file":file_path,
        "language":"javascript/react",
        "imports":imports,
        "functions":functions
    }

