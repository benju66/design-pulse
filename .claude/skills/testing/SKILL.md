---
name: testing
description: Use when writing or running automated tests in design-pulse, or establishing a regression baseline before/after a change. Covers the Vitest unit and integration suites, Playwright E2E, and pytest backend — the unit-vs-integration split (unit needs no credentials), exact commands, env-var credential handling, and data-safety rules for mutating tests.
---

Claude-format pointer to the canonical Antigravity skill. The authoritative testing guide lives
in [`.agent/skills/testing/SKILL.md`](../../../.agent/skills/testing/SKILL.md).

**Before writing or running tests, read that file in full** — it is the single source of truth
for suite locations, commands, the unit-vs-integration split, credential handling
(`TEST_USER_EMAIL` / `TEST_USER_PASSWORD` from `.env.local`), and the regression policy. Do not
duplicate its content here.
