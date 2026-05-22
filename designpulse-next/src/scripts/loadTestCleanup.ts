/**
 * load-test-cleanup: Removes all load-test rows from the target project.
 * Usage: npx tsx src/scripts/loadTestCleanup.ts <PROJECT_ID>
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Robust local env loading fallback if standard dotenv loading doesn't capture it
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value.trim();
        }
      });
    }
  } catch (e) {
    console.warn('Could not read .env.local file', e);
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error('Usage: npx tsx src/scripts/loadTestCleanup.ts <PROJECT_ID>');
    process.exit(1);
  }

  console.log(`Authenticating as test user: burness@fpcinc.com...`);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'burness@fpcinc.com',
    password: 'BuildIt2026!!',
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    process.exit(1);
  }
  console.log('✅ Successfully authenticated.');

  console.log(`Soft-deleting load-test rows from project: ${projectId}...`);
  
  const { data, error, count } = await supabase
    .from('opportunities')
    .update({ is_deleted: true }, { count: 'exact' })
    .like('title', 'Load Test – %')
    .eq('project_id', projectId)
    .select('id');

  if (error) {
    console.error('❌ Soft-delete failed:', error.message);
    process.exit(1);
  }

  const deletedCount = count ?? (data ? data.length : 0);
  console.log(`\n✅ Cleanup complete: soft-deleted ${deletedCount} coordination tasks from project ${projectId}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
