require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase.rpc('lock_opportunity_option', {
    p_option_id: '00000000-0000-0000-0000-000000000000',
    p_opp_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('Valid UUID Error:', error);
}

run();
