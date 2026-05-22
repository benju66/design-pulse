const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yrfzwtemupbesyunggcm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZnp3dGVtdXBiZXN5dW5nZ2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDk2NjUsImV4cCI6MjA5MjQ4NTY2NX0.PQeRfVpsrr-H1nxgK_1ztlNBqL1z7ckdM3VGacQbT_4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Logging in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'burness@fpcinc.com',
    password: 'BuildIt2026!!'
  });
  
  if (authError) {
    console.error('Login failed:', authError);
    return;
  }
  console.log('Login successful for:', authData.user.email);

  console.log('Fetching project_estimate_versions...');
  let { data, error } = await supabase.from('project_estimate_versions').select('*');
  if (error) {
    console.error(error);
    return;
  }
  console.log('Versions:', JSON.stringify(data, null, 2));
}

test();
