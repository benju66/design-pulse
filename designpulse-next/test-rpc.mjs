import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yrfzwtemupbesyunggcm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZnp3dGVtdXBiZXN5dW5nZ2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDk2NjUsImV4cCI6MjA5MjQ4NTY2NX0.PQeRfVpsrr-H1nxgK_1ztlNBqL1z7ckdM3VGacQbT_4'
);

async function run() {
  const { data, error } = await supabase.rpc('lock_opportunity_option', {
    p_option_id: '00000000-0000-0000-0000-000000000000',
    p_opp_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('Valid UUID Error:', error);
}

run();
