import json
import codecs

try:
    with codecs.open('lint-results.json', 'r', 'utf-16') as f:
        results = json.load(f)
except:
    with codecs.open('lint-results.json', 'r', 'utf-8') as f:
        results = json.load(f)

for r in results:
    if r['errorCount'] > 0:
        print(f"{r['filePath']}")
        for m in r['messages']:
            if m['severity'] > 0:
                print(f"  Line {m['line']}: {m.get('ruleId')}")
