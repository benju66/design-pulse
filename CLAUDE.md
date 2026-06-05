# CLAUDE.md

Guidance for Claude Code working in the `design-pulse` repo. For the full project overview,
domain terminology, and house guardrails, see **[AGENTS.md](AGENTS.md)** — it is the primary
project doc and applies here too.

## Two Skill Systems (read this to avoid confusion)

This repo carries skills for **two different agent runtimes**, with **identical names** so the
mapping is 1:1:

| Location | Runtime | Role |
|---|---|---|
| `.agent/skills/<name>/SKILL.md` | **Antigravity** | **Canonical content** — the full, authoritative rulesets. Plain-markdown playbooks routed manually via the AGENTS.md "SKILL ROUTING TABLE". |
| `.claude/skills/<name>/SKILL.md` | **Claude Code** | **Thin pointers** with YAML frontmatter so they auto-trigger. Each one redirects you to read its canonical `.agent/skills/<name>/SKILL.md`. |

**Single source of truth:** edit rules in `.agent/skills/`. The `.claude/skills/` files exist
only so the knowledge auto-surfaces in Claude Code — they must not accumulate their own copy of
the rules. When you change a canonical skill, the pointer needs no change.

Current skills (both systems): `database-guardrails`, `data-table-architecture`,
`frontend-architecture`, `api-and-integration`, `feature-discovery`, `deep-review`,
`verify-feature`, `load-test-coordination`, `testing`.

### Prefer Claude built-ins for review & verification
- For reviewing a diff, use the built-in **`/code-review`**. The `deep-review` skill only adds
  the project's plan/review gate on top.
- For confirming a change works, use the built-in **`/verify`**. The `verify-feature` skill only
  adds the project's Definition-of-Done gate on top.

## Testing & Credentials

The **`testing`** skill is the single source for the test stack (Vitest unit/integration,
Playwright E2E, pytest backend). Tests authenticate with a **dedicated test account** via
`TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `designpulse-next/.env.local` (git-ignored; see
`.env.local.example`). **Never hardcode credentials** in code, tests, skills, or docs.
