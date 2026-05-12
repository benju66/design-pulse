import asyncio
import os
import fitz
import time
from supabase import create_client
from dotenv import load_dotenv

from services.worker import process_sheet_job
from services.pdf_inspector import inspect_and_stage_pdf

load_dotenv()

async def run_job(supabase, sheet_id, delay=0):
    if delay > 0:
        print(f'Sleeping for {delay} seconds...')
        await asyncio.sleep(delay)
        
    doc = fitz.open()
    page = doc.new_page()
    page.draw_rect(page.rect, color=(0,0,0), width=2)
    pdf_bytes = doc.write()
    doc.close()
    
    project_id = 'f3a0d50a-d2f4-4627-aabc-b29ae6cb8424'
    
    supabase.table('project_sheets').delete().eq('id', sheet_id).execute()
    supabase.table('project_sheets').insert({
        'id': sheet_id,
        'project_id': project_id,
        'sheet_name': f'Test {sheet_id}',
        'status': 'processing'
    }).execute()
    
    res = inspect_and_stage_pdf(pdf_bytes, project_id, 'test.pdf', supabase)
    print(f'Staged {sheet_id}: {res["staged_key"]}')
    
    await process_sheet_job(
        sheet_id=sheet_id,
        project_id=project_id,
        staged_key=res['staged_key'],
        page_index=0,
        source_filename='test.pdf'
    )
    
    row = supabase.table('project_sheets').select('*').eq('id', sheet_id).execute()
    print(f'Final status {sheet_id}: {row.data[0]["status"]}')

async def main():
    supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    print('--- JOB 1 ---')
    await run_job(supabase, '00000000-0000-0000-0000-000000000001', 0)
    
    print('\n--- JOB 2 ---')
    await run_job(supabase, '00000000-0000-0000-0000-000000000002', 65)

if __name__ == '__main__':
    asyncio.run(main())
