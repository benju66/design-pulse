const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pmccdxmuszuykawvlphj.supabase.co';
const supabaseKey = 'sb_publishable_NxweMCXpjLfVMoABNA0QvA_LP1OrM3P';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing singular opportunity...');
  let { error } = await supabase.from('opportunity').select('*').limit(1);
  console.log(error);
  
  console.log('Testing status_logs...');
  let { error: err2 } = await supabase.from('status_logs').select('*').limit(1);
  console.log(err2);
  
  console.log('Testing markups...');
  let { error: err3 } = await supabase.from('markups').select('*').limit(1);
  console.log(err3);
}

test();
