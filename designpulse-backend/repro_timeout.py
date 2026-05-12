import time
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])

print('Making first request...')
supabase.table('projects').select('id').limit(1).execute()
print('Sleeping for 65 seconds to let Kong drop the idle connection...')
time.sleep(65)
print('Making second request...')
try:
    supabase.table('projects').select('id').limit(1).execute()
    print('Success!')
except Exception as e:
    print(f'Error: {type(e).__name__} - {e}')
