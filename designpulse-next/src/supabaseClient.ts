import { createClient } from '@supabase/supabase-js';

// Using your provided project URL and Publishable (anon) Key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pmccdxmuszuykawvlphj.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZnp3dGVtdXBiZXN5dW5nZ2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDk2NjUsImV4cCI6MjA5MjQ4NTY2NX0.PQeRfVpsrr-H1nxgK_1ztlNBqL1z7ckdM3VGacQbT_4';

export const supabase = createClient(supabaseUrl, supabaseKey);
