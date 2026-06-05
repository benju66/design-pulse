---
name: deep-review
description: Use to review a planned change or diff in design-pulse against project guardrails before writing code. In Claude Code, prefer the built-in /code-review for correctness bug-hunting; reach for this skill when you specifically need the project's plan/review gate, skill routing, and the database/immutability compliance checklist.
---

In Claude Code, **the built-in `/code-review` is the primary tool** for hunting correctness
bugs in a diff — use it first.

This skill adds the project-specific review process on top: routing to the matching domain
skills, the multi-table-RPC / immutability / advisory-lock compliance sweep, topological
ordering of plan steps, and the "present a review table and stop for approval" gate.

The authoritative procedure lives in
[`.agent/skills/deep-review/SKILL.md`](../../../.agent/skills/deep-review/SKILL.md) — read it
in full when running the project review gate. Verification steps it references live in the
`testing` and `verify-feature` skills.
