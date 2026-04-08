def build_chunks(parsed_files:list,project_id:str):
    chunks=[]
    global_index = 0

    for file_data in parsed_files:
        file_path=file_data.get("file","")
        language=file_data.get("language","unknown")
        functions=file_data.get("functions",[])
        raw_imports=file_data.get("imports",[])

        # --- FIX 1: Always generate a file-level overview chunk ---
        # This ensures every file is searchable even if it has zero detected functions
        # (e.g. React.forwardRef, pure exports, config files, type-only files)
        import_summary = "\n".join(raw_imports[:20]) if raw_imports else "No imports detected"
        fn_names = [f.get("name","anonymous") for f in functions] if functions else []
        overview_text = (
            f"File: {file_path} | Language: {language}\n"
            f"Functions defined ({len(fn_names)}): {', '.join(fn_names) if fn_names else 'none'}\n"
            f"Imports ({len(raw_imports)}):\n{import_summary}"
        )
        chunks.append({
            "id":         f"{project_id}__{file_path}__OVERVIEW__{global_index}",
            "text":       overview_text,
            "file":       file_path,
            "name":       "__overview__",
            "type":       "file_overview",
            "start_line": 1,
            "end_line":   1,
            "language":   language,
            "project_id": project_id
        })
        global_index += 1

        for fn in functions:
            code=fn.get("code","")
            fn_name = fn.get("name", "anonymous")
            start   = fn.get("start_line", 0)
            end     = fn.get("end_line", 0)
            lines = code.split("\n")

            if len(lines)<=80:
                chunk_text=(
                    f"File: {file_path} | Language: {language} | "
                    f"Function: {fn_name} | Lines: {start}-{end}\n\n"
                    f"{code}"
                )

                chunks.append({
                    "id":         f"{project_id}__{file_path}__{fn_name}__{start}__{global_index}",
                    "text":       chunk_text,
                    "file":       file_path,
                    "name":       fn_name,
                    "type":       "function",
                    "start_line": start,
                    "end_line":   end,
                    "language":   language,
                    "project_id": project_id
                })
                global_index += 1
            else:
                window_size = 80
                overlap     = 15
                step        = window_size - overlap
                chunk_index = 0

                for i in range(0, len(lines), step):
                    window_lines = lines[i : i + window_size]
                    window_code  = "\n".join(window_lines)
                    window_start = start + i
                    window_end   = start + i + len(window_lines)
                    chunk_text = (
                        f"File: {file_path} | Language: {language} | "
                        f"Function: {fn_name} (part {chunk_index + 1}) | "
                        f"Lines: {window_start}-{window_end}\n\n"
                        f"{window_code}"
                    )
                    chunks.append({
                        "id":         f"{project_id}__{file_path}__{fn_name}__{window_start}__{global_index}",
                        "text":       chunk_text,
                        "file":       file_path,
                        "name":       fn_name,
                        "type":       "function",
                        "start_line": window_start,
                        "end_line":   window_end,
                        "language":   language,
                        "project_id": project_id
                    })
                    chunk_index += 1
                    global_index += 1
    return chunks

    
        