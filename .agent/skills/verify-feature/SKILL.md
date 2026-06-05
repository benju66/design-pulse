<!-- Canonical content (Antigravity). Claude mirror: .claude/skills/verify-feature/ (pointer only). In Claude Code, prefer the built-in /verify; use this for the project-specific Definition-of-Done gate. -->
# TASK: Post-Implementation Verification & Teardown

Execute these steps sequentially. Stop and ask for clarification if any step fails or encounters an unexpected state.

**Step 1: Intent vs. Execution Audit**
Review the original Implementation Plan and compare it directly against the current state of the file system, independent of version control.
* Identify all files you created, modified, or deleted during this current implementation session.
* Read the current contents of those specific files into your context.
* Conduct a code review against `.antigravityrules`: Verify there are 0 leftover `console.log` statements, 0 placeholder `// TODO` comments, and 0 hardcoded mock variables.
* Conduct a date-handling audit: If any date modifications exist, confirm they exclusively leverage component-based regex utilities from `src/lib/formatters.ts` to block local browser timezone shifting bugs.

**Step 2: Cross-Surface Verification**
Do not just read the code—prove it works.
* Run the automated suites in the terminal workspace. See the `testing` skill for the suite inventory, exact commands, and the unit-vs-integration split. Run at minimum the suites covering the surfaces you touched; treat any newly-failing test as a regression.
* If UI/UX components were altered, simulate or execute browser state validations targeting Design Pulse core surfaces (e.g., Excel-style TanStack data grids, locking interactions on the Contenders Matrix, or React Konva canvas vector markups).
* For browser environment tests, authenticate at `http://localhost:8000/` using the dedicated test account from environment variables (`TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `.env.local`) — never hardcode credentials. See the `testing` skill.
* Report the exact terminal commands executed and their output traces.

**Step 3: Architecture & Rule Sync**
Review the newly written code against `architecture.md` and `AGENTS.md`. 
* Did this feature introduce new data mutations, alter PostgreSQL schemas, inject RPCs, or change external API integration flows? If yes, automatically draft the required updates to `architecture.md` using the C4 Model structure.
* Are there new architectural guardrails, constraints, or reusable patterns established here that must be appended to `AGENTS.md` or its sub-skills?

**Step 4: The Merge Gate**
Present a final "Definition of Done" report summarizing the test results, workspace cleanup confirmation, and documentation updates. **Stop entirely.** Do not attempt to commit, push, or merge this worktree into the main branch until I explicitly reply with "Approved."