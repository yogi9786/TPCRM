import os
import glob
import re

router_files = glob.glob('routers/*.py')
count_files = 0
count_endpoints = 0

for filepath in router_files:
    if '__init__' in filepath:
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'from fastapi_cache.decorator import cache' not in content:
        # Find imports
        if 'from fastapi import' in content:
            content = content.replace(
                'from fastapi import',
                'from fastapi_cache.decorator import cache\nfrom fastapi import',
                1
            )
        else:
            content = 'from fastapi_cache.decorator import cache\n' + content
            
        # Regex to find @router.get(...) and add @cache(expire=30) right after it
        # Handle cases where there might be spaces or other decorators
        
        # We find @router.get(something)
        # followed by anything (non greedy) up to async def or def
        # Actually it's easier: just replace @router.get(.*)\nasync def with @router.get(.*)\n@cache(expire=30)\nasync def
        
        def replacer(match):
            global count_endpoints
            count_endpoints += 1
            return f"{match.group(1)}\n@cache(expire=30)\n{match.group(2)}"
            
        new_content = re.sub(r'(@router\.get\([^)]*\))\s+(async def|def)', replacer, content)
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            count_files += 1
            print(f"Updated {filepath}")

print(f"Processed {count_files} files, modified {count_endpoints} endpoints.")
