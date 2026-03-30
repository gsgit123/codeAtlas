import os
from .js_parser import parse_javascript
from .py_parser import parse_python


def process_project(project_path:str):
    parsed_files=[]

    if not os.path.exists(project_path):
        raise FileNotFoundError(f"Directory {project_path} not found")
    
    for root,dirs,files in os.walk(project_path):
        if any(ignored in root for ignored in ['node_modules', '.git', 'venv', '__pycache__', 'dist', 'build']):
            continue

        for file in files:
            file_path=os.path.join(root,file)

            try:
                if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                    with open(file_path, 'rb') as f:
                        content = f.read()
                    parsed_files.append(parse_javascript(content, file_path))
                    
                elif file.endswith('.py'):
                    with open(file_path, 'rb') as f:
                        content = f.read()
                    parsed_files.append(parse_python(content, file_path))
            
            except Exception as e:
                print(f"Warning: Failed to parse {file_path}, Error: {e}")
    
    return parsed_files


if __name__ == "__main__":
    project_path = "/path/to/your/project"
    parsed_data = process_project(project_path)
    print(f"Parsed {len(parsed_data)} files.")