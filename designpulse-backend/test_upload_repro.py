import asyncio
import os
import fitz
from supabase import create_client
from dotenv import load_dotenv

from services.worker import process_sheet_job
from services.pdf_inspector import inspect_and_stage_pdf

load_dotenv()

async def main():
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    
    # 1. Create a dummy PDF in memory
    doc = fitz.open()
    page = doc.new_page()
    page.draw_rect(page.rect, color=(0,0,0), width=2)
    pdf_bytes = doc.write()
    doc.close()
    
    project_id = "f3a0d50a-d2f4-4627-aabc-b29ae6cb8424"
    sheet_id = "00000000-0000-0000-0000-000000001234"
    
    # Clean up old test row if exists
    supabase.table("project_sheets").delete().eq("id", sheet_id).execute()
    
    # Create test row
    supabase.table("project_sheets").insert({
        "id": sheet_id,
        "project_id": project_id,
        "sheet_name": "Test Sheet",
        "status": "processing"
    }).execute()
    
    print("Staging PDF...")
    try:
        res = inspect_and_stage_pdf(pdf_bytes, project_id, "test.pdf", supabase)
        staged_key = res["staged_key"]
        print(f"Staged key: {staged_key}")
        
        print("Running worker...")
        await process_sheet_job(
            sheet_id=sheet_id,
            project_id=project_id,
            staged_key=staged_key,
            page_index=0,
            source_filename="test.pdf"
        )
        
        row = supabase.table("project_sheets").select("*").eq("id", sheet_id).execute()
        print(f"Final status: {row.data[0]['status']}, message: {row.data[0]['status_message']}")
        
    except Exception as e:
        print(f"Error during test: {e}")

if __name__ == "__main__":
    asyncio.run(main())
