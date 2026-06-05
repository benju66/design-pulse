---
name: verify-feature
description: Use after implementing a change in design-pulse to verify it works end-to-end and produce a Definition-of-Done report. In Claude Code, prefer the built-in /verify; reach for this skill when you need the project's full gate — test-suite runs, workspace cleanup audit (no stray console.log/TODO/mocks), and architecture/AGENTS doc sync.
---

In Claude Code, **the built-in `/verify` is the primary tool** for confirming a change actually
works — use it first.

This skill adds the project-specific Definition-of-Done gate on top: an intent-vs-execution
audit against the plan, the workspace cleanup sweep (zero leftover `console.log`, `// TODO`,
or hardcoded mocks), date-handling checks against `src/lib/formatters.ts`, doc sync to
`architecture.md` / `AGENTS.md`, and the "stop and wait for Approved" merge gate.

The authoritative procedure lives in
[`.agent/skills/verify-feature/SKILL.md`](../../../.agent/skills/verify-feature/SKILL.md) — read
it in full. For suite commands and credential handling, see the `testing` skill.
