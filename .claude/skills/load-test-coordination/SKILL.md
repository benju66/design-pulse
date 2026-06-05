---
name: load-test-coordination
description: Use to load-test the Coordination Board in design-pulse — generate ~1,000 mock coordination rows, reproduce the React #185 ("Maximum update depth exceeded") re-render crash on navigate-away/back, then clean up. Covers the mock-data generator, Playwright reproduction, and cleanup scripts.
---

Claude-format pointer to the canonical Antigravity skill. The authoritative procedure lives in
[`.agent/skills/load-test-coordination/SKILL.md`](../../../.agent/skills/load-test-coordination/SKILL.md).

**Before running a load test, read that file in full** — it is the single source of truth and
is maintained there. The referenced scripts already exist under
`designpulse-next/src/scripts/loadTest*.ts`; reuse them rather than regenerating. Credentials
come from `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `.env.local` (see the `testing` skill).
