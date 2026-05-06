import sys
path = 'c:/Users/BUrness/Dev/design-pulse/supabase_schema.sql'

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('AS \n  SELECT \n    u.id,', 'AS $$\n  SELECT \n    u.id,')
text = text.replace('     );\n;\n\nCREATE OR REPLACE', '     );\n$$;\n\nCREATE OR REPLACE')

text = text.replace('AS \nBEGIN\n  -- Check if caller', 'AS $$\nBEGIN\n  -- Check if caller')
text = text.replace('  WHERE pm.project_id = p_project_id;\nEND;\n;\n', '  WHERE pm.project_id = p_project_id;\nEND;\n$$;\n')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print("fixed")
