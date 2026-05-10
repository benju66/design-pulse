import sys
import os
import json
from dotenv import load_dotenv

load_dotenv()
from main import supabase

def migrate_legacy_markups():
    print("--- STARTING MILESTONE 3: MIGRATION ---")
    print("Fetching opportunities with design_markups...")
    
    try:
        # Supabase Python client handles pagination limits, but for safety we will fetch everything.
        res = supabase.table("opportunities").select("id, project_id, design_markups").execute()
        opportunities = res.data
    except Exception as e:
        if "design_markups does not exist" in str(e):
            print("Legacy `design_markups` column has already been removed or never existed.")
            print("No migration necessary. Milestone 3 is natively complete.")
            return
        raise e
    
    if not opportunities:
        print("No opportunities found.")
        return
        
    project_opps = {}
    valid_count = 0
    for opp in opportunities:
        pid = opp.get("project_id")
        if not pid: continue
        
        markups = opp.get("design_markups")
        if not markups or not isinstance(markups, list) or len(markups) == 0:
            continue
            
        if pid not in project_opps:
            project_opps[pid] = []
            
        project_opps[pid].append({
            "opp_id": opp["id"],
            "markups": markups
        })
        valid_count += 1
        
    print(f"Found {valid_count} opportunities with valid markups. Grouping by {len(project_opps)} projects...")
    
    if len(project_opps) == 0:
        print("No valid markups found to migrate.")
        return
        
    for pid, opps in project_opps.items():
        print(f"Processing Project {pid} with {len(opps)} opportunities...")
        
        # Check if legacy sheet already exists
        sheet_res = supabase.table("project_sheets").select("id").eq("project_id", pid).eq("sheet_name", "Legacy Sheet").execute()
        
        if len(sheet_res.data) > 0:
            sheet_id = sheet_res.data[0]["id"]
            print(f"  Using existing Legacy Sheet: {sheet_id}")
            
            # To be safe, clear existing legacy markups to avoid duplicate migrations during testing
            print("  Clearing existing migrated markups for idempotency...")
            supabase.table("sheet_markups").delete().eq("sheet_id", sheet_id).execute()
        else:
            # Create legacy sheet
            new_sheet = {
                "project_id": pid,
                "sheet_name": "Legacy Sheet",
                "status": "ready"
            }
            create_res = supabase.table("project_sheets").insert(new_sheet).execute()
            sheet_id = create_res.data[0]["id"]
            print(f"  Created new Legacy Sheet: {sheet_id}")
            
        # Migrate markups
        markups_to_insert = []
        for opp in opps:
            opp_id = opp["opp_id"]
            for m in opp["markups"]:
                markups_to_insert.append({
                    "sheet_id": sheet_id,
                    "opportunity_id": opp_id,
                    "geometry": m,
                    "style": {},
                    "metadata": {"migrated": True, "legacy_id": m.get("id", None)}
                })
                
        if len(markups_to_insert) > 0:
            print(f"  Inserting {len(markups_to_insert)} markups into sheet_markups...")
            # Chunking inserts to respect API limits if needed (batching by 50)
            chunk_size = 50
            for i in range(0, len(markups_to_insert), chunk_size):
                chunk = markups_to_insert[i:i + chunk_size]
                supabase.table("sheet_markups").insert(chunk).execute()
            
            print("  Done.")
            
    print("Migration complete! Legacy data preserved in opportunities.design_markups for safety until frontend integration is verified.")

if __name__ == "__main__":
    migrate_legacy_markups()
