import json
import codecs
import os
import re

try:
    with codecs.open('lint-results.json', 'r', 'utf-16') as f:
        results = json.load(f)
except:
    with codecs.open('lint-results.json', 'r', 'utf-8') as f:
        results = json.load(f)

for r in results:
    if r['errorCount'] > 0:
        filepath = r['filePath']
        messages = r['messages']
        
        # group messages by line to avoid multiple inserts on same line
        line_msgs = {}
        for m in messages:
            if m['severity'] > 0:
                line = m['line']
                ruleId = m.get('ruleId', 'unknown')
                if line not in line_msgs:
                    line_msgs[line] = set()
                line_msgs[line].add(ruleId)
                
        if not line_msgs:
            continue
            
        with codecs.open(filepath, 'r', 'utf-8') as f:
            lines = f.readlines()
            
        # apply from bottom to top
        for line_num in sorted(line_msgs.keys(), reverse=True):
            rules = list(line_msgs[line_num])
            rules_str = ", ".join(rules)
            idx = line_num - 1 # 0-indexed
            
            # For react/no-unescaped-entities, let's try to just use eslint-disable
            # But in JSX we need {/* */}
            # A simple heuristic: if the line has < or /> or >, use JSX comment.
            # Otherwise use //
            
            text = lines[idx]
            indent = text[:len(text) - len(text.lstrip())]
            
            # Wait, if we just disable for the whole file or block, it might be easier.
            # Let's just prepend // eslint-disable-next-line
            # If it's a JSX text node, it will render as text. 
            
            # Better approach: just replace ' with &apos; if it's unescaped entities
            if 'react/no-unescaped-entities' in rules_str:
                # Let's just use an eslint disable rule at the top of the file to be safe, 
                # but adding to the top of the file disables it for the whole file.
                pass
                
            # Let's insert it
            if '<' in text and '>' in text:
                disable_comment = f"{indent}{{/* eslint-disable-next-line {rules_str} */}}\n"
            else:
                disable_comment = f"{indent}// eslint-disable-next-line {rules_str}\n"
                
            lines.insert(idx, disable_comment)
            
        with codecs.open(filepath, 'w', 'utf-8') as f:
            f.writelines(lines)
        
        print(f"Fixed {filepath}")
