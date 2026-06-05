<!-- Canonical content (Antigravity). Claude mirror: .claude/skills/testing/ (pointer only). -->
# Testing & QA Skill

This skill applies whenever you write, run, or reason about automated tests, or need a
regression baseline before/after a change. It is the **single source of truth** for the
project's test stack — other skills (`deep-review`, `verify-feature`) point here instead of
inlining commands.

## Suite Inventory

| Suite | Location | Runner | Needs Supabase creds? | Covers |
|---|---|---|---|---|
| Frontend **unit** | `designpulse-next/tests/unit/` | Vitest | **No** | `financialMath`, `useUIStore` (pure logic, guards) |
| Frontend **integration** | `designpulse-next/tests/integration/` | Vitest (jsdom) | **Yes** | RLS policies, financial immutability triggers, RBAC RPCs |
| **E2E** | `designpulse-next/tests/e2e/` | Playwright | **Yes** + running dev server | Login → project → Value Matrix → Coordination flows |
| Backend | `designpulse-backend/tests/` | pytest | No | PDF validation boundaries, vector-extraction coordinate math |

## Commands

Run from the relevant package root.

* **Unit only (no credentials, safe on any checkout / CI fork):**
  `cd designpulse-next && npx vitest run tests/unit/`
* **Integration (requires `.env.local`, see below):**
  `cd designpulse-next && npx vitest run tests/integration/`
* **Everything Vitest (`npm test` === `vitest run`):**
  `cd designpulse-next && npm test` — note this includes integration, so it needs creds.
* **E2E (dev server must already be running on port 8000):**
  `cd designpulse-next && npm run test:e2e`
* **Backend:**
  `cd designpulse-backend && python -m pytest tests/ -v`
  (Windows venv: `.\venv\Scripts\python.exe -m pytest tests/ -v`)

## Credential Handling — NEVER Hardcode

Tests that authenticate use a **dedicated test account**, supplied via environment variables,
never literals in source:

* `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` — read from `process.env`.
* Stored in `designpulse-next/.env.local` (git-ignored). See `.env.local.example` for the keys.
* Integration tests also need `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
* Optional integration scoping: `TEST_SANDBOX_PROJECT_ID` (a throwaway project the
  destructive immutability tests write to — they skip when it is unset) and
  `TEST_USER_IS_PLATFORM_ADMIN` (`'true'` tightens the RBAC assertions). The suite
  is capability-aware and safe-by-default: with neither set, it runs read-oriented
  checks and never mutates arbitrary production data.
* `vitest.config.ts` and `playwright.config.ts` load `.env.local` and expose these to the test
  process. If they are absent, credential-dependent suites must fail loudly or skip — never
  silently pass.

> Do not commit credentials to any test, script, skill, or doc. If you find a hardcoded
> `@` email + password pair anywhere, treat it as a security defect and move it to env vars.

## Data Safety for Mutating Tests

Integration tests authenticate as a real user. Any test that issues `INSERT`/`UPDATE`/`DELETE`
MUST target a **dedicated sandbox project** (or wrap the mutation in an RPC that rolls back) —
never live/production rows. A test whose only safety net is "the DB trigger will reject it" can
silently corrupt data the day that trigger changes. Prefer read-only assertions; when a write
is unavoidable, scope it to throwaway fixtures you created in the same test.

## Regression Policy

Run the relevant suite **after every change**. Treat any test that newly fails — one that
passed before your change — as a regression to fix or explain before proceeding; do not move on.
Do not quote a fixed "number of tests" as a success signal (counts drift); the signal is
"no new failures."

## Authoring Guidance

* A test must exercise the real subject under test. Asserting on a value the test fixture
  itself produced (e.g. a factory that coerces `null`→`0` before the SUT sees it), or grepping
  source text for a constant, is a tautology — it cannot catch the regression its name implies.
* RLS/permission tests only prove isolation when run as a **non-privileged** user. A
  platform-admin session bypasses RLS, so "blocked" assertions may pass for unrelated reasons
  (FK violation, empty result) rather than the policy under test.
