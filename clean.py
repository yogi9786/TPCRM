import os
import tokenize
import io

def clean_file(filepath):
    print(f"Cleaning {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        source = f.read()

    # Remove comments using tokenize
    io_obj = io.StringIO(source)
    out = []
    last_lineno = -1
    last_col = 0
    try:
        for tok in tokenize.generate_tokens(io_obj.readline):
            token_type = tok[0]
            token_string = tok[1]
            start_line, start_col = tok[2]
            end_line, end_col = tok[3]
            
            if start_line > last_lineno:
                last_col = 0
            if start_col > last_col:
                out.append(" " * (start_col - last_col))
                
            if token_type == tokenize.COMMENT:
                pass
            else:
                out.append(token_string)
                
            last_lineno = end_line
            last_col = end_col
    except tokenize.TokenError:
        print(f"Token error in {filepath}")
        return

    cleaned_source = "".join(out)
    
    # Remove logger
    lines = cleaned_source.split('\n')
    new_lines = []
    for line in lines:
        if 'import logging' in line or 'logger = ' in line:
            continue
        if 'logger.' in line:
            # Replace with pass to prevent empty block syntax errors
            indent = line[:len(line) - len(line.lstrip())]
            new_lines.append(indent + 'pass')
        else:
            new_lines.append(line)
            
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))

for root, dirs, files in os.walk('c:/Users/wheny/OneDrive/Desktop/TPCRM/backend'):
    if '.venv' in dirs:
        dirs.remove('.venv')
    if 'node_modules' in dirs:
        dirs.remove('node_modules')
        
    for file in files:
        if file.endswith('.py'):
            clean_file(os.path.join(root, file))
