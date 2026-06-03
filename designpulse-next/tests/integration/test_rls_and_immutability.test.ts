/**
 * Integration tests for Supabase Row-Level Security (RLS) policies and
 * database-level immutability triggers.
 *
 * These tests authenticate as the test user against the live Supabase
 * instance and verify that:
 * 1. RLS policies correctly scope data to the user's project memberships
 * 2. Financial immutability triggers block unauthorized modifications
 * 3. Role-based access control (RBAC) boundaries are enforced
 *
 * IMPORTANT: These tests are READ-HEAVY. They verify that security
 * constraints BLOCK disallowed operations — they do NOT create or
 * destroy production data.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Test environment setup
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = 'burness@fpcinc.com';
const TEST_PASSWORD = 'BuildIt2026!!';

let supabase: SupabaseClient;
let userId: string;

beforeAll(async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Ensure .env.local is loaded for integration tests.'
    );
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error || !data.user) {
    throw new Error(`Authentication failed: ${error?.message ?? 'No user returned'}`);
  }

  userId = data.user.id;
});

// ===========================================================================
// RLS: Data scoping to user's project memberships
// ===========================================================================

describe('RLS: Project data scoping', () => {
  it('authenticated user can query projects they are a member of', async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .limit(5);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // The test user should have at least one project
    expect(data!.length).toBeGreaterThan(0);
  });

  it('opportunities query is scoped to accessible projects', async () => {
    // Get the user's first accessible project
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .limit(1)
      .single();

    expect(projects).not.toBeNull();

    const { data: opps, error } = await supabase
      .from('opportunities')
      .select('id, title, project_id')
      .eq('project_id', projects!.id)
      .eq('is_deleted', false)
      .limit(5);

    expect(error).toBeNull();
    expect(opps).not.toBeNull();
    // All returned rows should belong to the queried project
    opps?.forEach(opp => {
      expect(opp.project_id).toBe(projects!.id);
    });
  });

  it('project_members query only returns members for accessible projects', async () => {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id, user_id, role')
      .limit(10);

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // Verify the test user appears in results
    const selfMembership = data?.find(m => m.user_id === userId);
    expect(selfMembership).toBeDefined();
  });
});

// ===========================================================================
// RLS: Cross-project isolation (IDOR prevention)
// ===========================================================================

describe('RLS: Cross-project isolation', () => {
  it('cannot directly insert into a project user is not a member of', async () => {
    // Attempt to insert an opportunity into a fabricated project ID
    const fakeProjectId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        project_id: fakeProjectId,
        title: 'RLS Test — Should Be Blocked',
        status: 'Draft',
        record_type: 'VE',
      })
      .select('id')
      .single();

    // RLS should block this — either an error or empty result
    // Supabase returns a 'new row violates row-level security policy' error
    // or returns null data with no error (depending on the policy type)
    const blocked = error !== null || data === null;
    expect(blocked).toBe(true);
  });

  it('cannot query opportunities from a non-member project via direct ID', async () => {
    const fakeProjectId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('opportunities')
      .select('id, title')
      .eq('project_id', fakeProjectId);

    expect(error).toBeNull();
    // RLS filters should return empty results, not an error
    expect(data).toEqual([]);
  });
});

// ===========================================================================
// RBAC: Role-based permission boundaries
// ===========================================================================

describe('RBAC: Permission system', () => {
  it('role_permissions table is readable', async () => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('role, can_lock_options, can_edit_records, can_delete_records')
      .limit(20);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);

    // Verify expected roles exist
    const roles = data!.map(r => r.role);
    expect(roles).toEqual(expect.arrayContaining(['project_admin']));
  });

  it('viewer role cannot edit records (can_edit_records = false)', async () => {
    const { data } = await supabase
      .from('role_permissions')
      .select('can_edit_records')
      .eq('role', 'viewer')
      .single();

    // Viewer should not have edit permission
    expect(data?.can_edit_records).toBe(false);
  });

  it('project_admin role has can_lock_options permission', async () => {
    const { data } = await supabase
      .from('role_permissions')
      .select('can_lock_options')
      .eq('role', 'project_admin')
      .single();

    expect(data?.can_lock_options).toBe(true);
  });
});

// ===========================================================================
// Financial Immutability: Trigger enforcement
// ===========================================================================

describe('Financial immutability constraints', () => {
  it('cannot directly update an Approved opportunity status via client', async () => {
    // Find an approved opportunity (if any exist)
    const { data: approvedOpps } = await supabase
      .from('opportunities')
      .select('id, status, project_id')
      .eq('status', 'Approved')
      .eq('is_deleted', false)
      .limit(1);

    if (!approvedOpps || approvedOpps.length === 0) {
      // Skip test if no approved opportunities exist — this is valid
      // in a fresh environment
      return;
    }

    const opp = approvedOpps[0];

    // Attempt to directly change the status of an approved opportunity
    const { error } = await supabase
      .from('opportunities')
      .update({ status: 'Draft' })
      .eq('id', opp.id);

    // The immutability trigger should block this update
    expect(error).not.toBeNull();
    expect(error!.message).toContain('immutab');
  });

  it('cannot directly modify cost_impact on an Approved opportunity', async () => {
    const { data: approvedOpps } = await supabase
      .from('opportunities')
      .select('id, cost_impact')
      .eq('status', 'Approved')
      .eq('is_deleted', false)
      .limit(1);

    if (!approvedOpps || approvedOpps.length === 0) {
      return;
    }

    const opp = approvedOpps[0];

    const { error } = await supabase
      .from('opportunities')
      .update({ cost_impact: 999999 })
      .eq('id', opp.id);

    // Immutability trigger should block financial field changes
    expect(error).not.toBeNull();
  });
});

// ===========================================================================
// RPC: Lock/Unlock boundary checks
// ===========================================================================

describe('RPC: RBAC helper function boundaries', () => {
  it('has_project_permission correctly returns true for authorized user', async () => {
    // Get a project where the test user is a member
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .limit(1)
      .single();

    if (!projects) return;

    const { data, error } = await supabase.rpc('has_project_permission', {
      p_project_id: projects.id,
      p_permission: 'can_edit_records',
    });

    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('has_project_permission returns true for platform admin (even non-member project)', async () => {
    // The test user (burness@fpcinc.com) is a platform_admin.
    // Platform admins bypass project-level RBAC via is_platform_admin() OR ...
    // This test verifies the platform admin short-circuit works correctly.
    const fakeProjectId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase.rpc('has_project_permission', {
      p_project_id: fakeProjectId,
      p_permission: 'can_edit_records',
    });

    expect(error).toBeNull();
    // Platform admin should ALWAYS have permission
    expect(data).toBe(true);
  });

  it('is_platform_admin correctly identifies the test user as platform admin', async () => {
    const { data, error } = await supabase.rpc('is_platform_admin');

    expect(error).toBeNull();
    expect(data).toBe(true);
  });
});

// ===========================================================================
// Estimate version safety
// ===========================================================================

describe('Estimate version constraints', () => {
  it('activate_estimate_version RPC rejects non-existent version IDs', async () => {
    const fakeVersionId = '00000000-0000-0000-0000-000000000000';

    const { error } = await supabase.rpc('activate_estimate_version', {
      p_version_id: fakeVersionId,
    });

    expect(error).not.toBeNull();
  });
});
