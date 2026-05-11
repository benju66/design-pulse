import os
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

SHEET_ID = "c976edc8-e29a-48b3-b341-afabf87573a1"

res = sb.table("project_sheets").select("*").eq("id", SHEET_ID).execute()
if res.data:
    row = res.data[0]
    pid = row.get("project_id", "")
    print("Sheet:", row.get("sheet_name"))
    print("Status:", row.get("status"))
    print("Progress:", row.get("progress_percent"))
    print("Max Zoom:", row.get("max_zoom"))
    print("Width:", row.get("original_width"))
    print("Height:", row.get("original_height"))
    print("Project ID:", pid)

    # Check tiles
    try:
        tile_path = pid + "/" + SHEET_ID + "/tiles"
        files = sb.storage.from_("project_drawings").list(tile_path)
        print("Tile zoom folders:", len(files), "entries")
        for f in files[:10]:
            print("  ", f.get("name"))
    except Exception as e:
        print("Tile listing error:", e)

    # Check pending PDF
    try:
        pending = pid + "/pending/" + SHEET_ID + ".pdf"
        pdata = sb.storage.from_("project_drawings").download(pending)
        print("Pending PDF exists:", len(pdata), "bytes")
    except Exception as e:
        print("No pending PDF:", e)

    # Check vectors.json
    try:
        vec_path = pid + "/" + SHEET_ID + "/vectors.json"
        vdata = sb.storage.from_("project_drawings").download(vec_path)
        print("vectors.json exists:", len(vdata), "bytes")
    except Exception as e:
        print("No vectors.json:", e)
else:
    print("Sheet not found in DB")
