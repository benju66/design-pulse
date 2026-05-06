import sys
import os

schema_path = 'c:/Users/BUrness/Dev/design-pulse/supabase_schema.sql'
with open(schema_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Safe replacements for schema
replacements = {
    "ENUM ('owner', 'gc_admin', 'design_team', 'viewer')": "ENUM ('project_admin', 'gc_admin', 'design_team', 'viewer')",
    "IN ('owner',": "IN ('project_admin',",
    "= 'owner')": "= 'project_admin')",
    "('owner', true,": "('project_admin', true,",
    "VALUES (v_project.id, auth.uid(), 'owner')": "VALUES (v_project.id, auth.uid(), 'project_admin')"
}

for old, new in replacements.items():
    text = text.replace(old, new)

with open(schema_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated supabase_schema.sql")

# Frontend types
types_path = 'c:/Users/BUrness/Dev/design-pulse/designpulse-next/src/types/database.types.ts'
if os.path.exists(types_path):
    with open(types_path, 'r', encoding='utf-8') as f:
        types_text = f.read()
    types_text = types_text.replace("'owner' | 'gc_admin'", "'project_admin' | 'gc_admin'")
    with open(types_path, 'w', encoding='utf-8') as f:
        f.write(types_text)
    print("Updated database.types.ts")

# useGlobalQueries
hooks_path = 'c:/Users/BUrness/Dev/design-pulse/designpulse-next/src/hooks/useGlobalQueries.ts'
if os.path.exists(hooks_path):
    with open(hooks_path, 'r', encoding='utf-8') as f:
        hooks_text = f.read()
    hooks_text = hooks_text.replace("role: 'owner' |", "role: 'project_admin' |")
    hooks_text = hooks_text.replace("['owner', 'gc_admin',", "['project_admin', 'gc_admin',")
    with open(hooks_path, 'w', encoding='utf-8') as f:
        f.write(hooks_text)
    print("Updated useGlobalQueries.ts")

# useProjectQueries
p_hooks_path = 'c:/Users/BUrness/Dev/design-pulse/designpulse-next/src/hooks/useProjectQueries.ts'
if os.path.exists(p_hooks_path):
    with open(p_hooks_path, 'r', encoding='utf-8') as f:
        phooks_text = f.read()
    phooks_text = phooks_text.replace("role: 'owner' |", "role: 'project_admin' |")
    with open(p_hooks_path, 'w', encoding='utf-8') as f:
        f.write(phooks_text)
    print("Updated useProjectQueries.ts")

# ProjectSettings.tsx
settings_path = 'c:/Users/BUrness/Dev/design-pulse/designpulse-next/src/components/project/ProjectSettings.tsx'
if os.path.exists(settings_path):
    with open(settings_path, 'r', encoding='utf-8') as f:
        set_text = f.read()
    set_text = set_text.replace("currentUserRole === 'owner'", "currentUserRole === 'project_admin'")
    with open(settings_path, 'w', encoding='utf-8') as f:
        f.write(set_text)
    print("Updated ProjectSettings.tsx")

# GlobalSettingsModal.tsx
global_path = 'c:/Users/BUrness/Dev/design-pulse/designpulse-next/src/components/dashboard/GlobalSettingsModal.tsx'
if os.path.exists(global_path):
    with open(global_path, 'r', encoding='utf-8') as f:
        g_text = f.read()
    g_text = g_text.replace("currentRole === 'owner'", "currentRole === 'project_admin'")
    g_text = g_text.replace("value=\"owner\"", "value=\"project_admin\"")
    g_text = g_text.replace(">Owner<", ">Project Admin<")
    with open(global_path, 'w', encoding='utf-8') as f:
        f.write(g_text)
    print("Updated GlobalSettingsModal.tsx")

