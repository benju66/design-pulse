/**
 * Integration tests for Supabase Row-Level Security (RLS) policies and
 * database-level immutability triggers.
 *
 * These tests authenticate as the configured test account
 * (TEST_USER_EMAIL / TEST_USER_PASSWORD) against the live Supabase instance.
 *
 * SAFETY: The suite is read-oriented and safe-by-default. The only tests that
 * issue writes against real rows (the financial-immutability checks) are gated
 * behind TEST_SANDBOX_PROJECT_ID and SKIP entirely unless it is set — so a plain
 * run never mutates arbitrary production data. When the sandbox var is set, those
 * tests scope their writes to that one throwaway project.
 *
 * CAPABILITY-AWARE: Assertions that depend on the account's privileges adapt to
 * what the account actually is, rather than assuming a project-member platform
 * admin. To assert the stricter privileged behaviour, point the suite at a
 * provisioned sandbox and set the optional flags below.
 *
 * Optional env (see .env.local.example):
 *   TEST_SANDBOX_PROJECT_ID    — a throwaway project the test account may write to.
 *   TEST_USER_IS_PLATFORM_ADMIN — 'true' if the account is a platform admin.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Test environment setup
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

// Optional capability/scoping configuration.
const SANDBOX_PROJECT_ID = process.env.TEST_SANDBOX_PROJECT_ID;
const EXPECT_PLATFORM_ADMIN = process.env.TEST_USER_IS_PLATFORM_ADMIN === 'true';
const PLATFORM_ADMIN_FLAG_SET = process.env.TEST_USER_IS_PLATFORM_ADMIN !== undefined;

let supabase: SupabaseClient;

beforeAll(async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Ensure .env.local is loaded for integration tests.'
    );
  }

  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      'Missing TEST_USER_EMAIL or TEST_USER_PASSWORD. See .env.local.example.'
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
});

// ===========================================================================
// RLS: Data scoping
// ===========================================================================

describe('RLS: Project data scoping', () => {
  it('authenticated user can read the projects table without error', async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .limit(5);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('opportunities reads are scoped to the queried project', async () => {
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .limit(1);

    // No visible project for this account → nothing to scope-check.
    if (!projects || projects.length === 0) return;
    const projectId = projects[0].id;

    const { data: opps, error } = await supabase
      .from('opportunities')
      .select('id, title, project_id')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .limit(5);

    expect(error).toBeNull();
    // Every returned row belongs to the queried project.
    opps?.forEach(opp => {
      expect(opp.project_id).toBe(projectId);
    });
  });

  it('project_members is readable under RLS without error', async () => {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id, user_id, role')
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

// ===========================================================================
// RLS: Cross-project isolation (IDOR prevention) — robust for any account
// ===========================================================================

describe('RLS: Cross-project isolation', () => {
  it('cannot insert an opportunity into a non-existent / non-member project', async () => {
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

    // Blocked either by RLS (error) or by returning no row. The fabricated
    // project id also cannot satisfy the foreign key, so no real row is created.
    const blocked = error !== null || data === null;
    expect(blocked).toBe(true);
  });

  it('querying opportunities for a non-member project returns no rows', async () => {
    const fakeProjectId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('opportunities')
      .select('id, title')
      .eq('project_id', fakeProjectId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

// ===========================================================================
// RBAC: Role-based permission catalogue
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

    const roles = data!.map(r => r.role);
    expect(roles).toEqual(expect.arrayContaining(['project_admin']));
  });

  it('viewer role cannot edit records (can_edit_records = false)', async () => {
    const { data } = await supabase
      .from('role_permissions')
      .select('can_edit_records')
      .eq('role', 'viewer')
      .single();

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
//
// WRITES against real rows — gated behind TEST_SANDBOX_PROJECT_ID and scoped to
// that project. Skipped entirely when the sandbox var is unset.
// ===========================================================================

describe.skipIf(!SANDBOX_PROJECT_ID)('Financial immutability constraints (sandbox only)', () => {
  it('cannot directly change the status of an Approved opportunity', async () => {
    const { data: approvedOpps } = await supabase
      .from('opportunities')
      .select('id, status, project_id')
      .eq('project_id', SANDBOX_PROJECT_ID!)
      .eq('status', 'Approved')
      .eq('is_deleted', false)
      .limit(1);

    // No Approved opportunity seeded in the sandbox → nothing to exercise.
    if (!approvedOpps || approvedOpps.length === 0) return;

    const { error } = await supabase
      .from('opportunities')
      .update({ status: 'Draft' })
      .eq('id', approvedOpps[0].id);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('immutab');
  });

  it('cannot directly modify cost_impact on an Approved opportunity', async () => {
    const { data: approvedOpps } = await supabase
      .from('opportunities')
      .select('id, cost_impact')
      .eq('project_id', SANDBOX_PROJECT_ID!)
      .eq('status', 'Approved')
      .eq('is_deleted', false)
      .limit(1);

    if (!approvedOpps || approvedOpps.length === 0) return;

    const { error } = await supabase
      .from('opportunities')
      .update({ cost_impact: 999999 })
      .eq('id', approvedOpps[0].id);

    expect(error).not.toBeNull();
  });
});

// ===========================================================================
// RPC: RBAC helper function boundaries
// ===========================================================================

describe('RPC: RBAC helper function boundaries', () => {
  it('has_project_permission is callable for a visible project', async () => {
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .limit(1);

    // No visible project → nothing to evaluate against.
    if (!projects || projects.length === 0) return;

    const { data, error } = await supabase.rpc('has_project_permission', {
      p_project_id: projects[0].id,
      p_permission: 'can_edit_records',
    });

    expect(error).toBeNull();
    expect(typeof data).toBe('boolean');
  });

  it('has_project_permission on a non-member project matches admin status', async () => {
    const fakeProjectId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase.rpc('has_project_permission', {
      p_project_id: fakeProjectId,
      p_permission: 'can_edit_records',
    });

    expect(error).toBeNull();
    // Only a platform admin short-circuits to true on a project they don't belong to.
    expect(data === true).toBe(EXPECT_PLATFORM_ADMIN);
  });

  it('is_platform_admin returns a boolean (and matches the configured flag, if set)', async () => {
    const { data, error } = await supabase.rpc('is_platform_admin');

    expect(error).toBeNull();
    expect(typeof data).toBe('boolean');
    if (PLATFORM_ADMIN_FLAG_SET) {
      expect(data).toBe(EXPECT_PLATFORM_ADMIN);
    }
  });
});

// ===========================================================================
// Estimate version safety — robust for any account
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
