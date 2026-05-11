import os
import threading
from supabase import create_client

local_data = threading.local()

def get_client():
    if not hasattr(local_data, 'client'):
        local_data.client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    return local_data.client
