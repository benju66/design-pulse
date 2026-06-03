Step 1: Primary Inspection \& Skill Routing
Review AGENTS.md and the current Implementation Plan. Identify the technical domain of the target changes and explicitly invoke the matching sub-skill from .agent/skills/ (e.g., database-guardrails, data-table-architecture, frontend-architecture). Identify bugs, logical gaps, unhandled edge cases, and security flaws. Update the plan to fix any issue causing a broken user flow, security flaw, or data loss.


Step 2: Secondary Sweep \& Guardrail Compliance
Conduct a secondary sweep focusing on imports, exports, and specific sub-skill constraints. If mutating database schemas or writing multi-table RPCs, explicitly confirm compliance with:

Transaction-scoped advisory locks (pg\_advisory\_xact\_lock).

Timing of the designpulse.bypass\_immutability escape hatch.

Type-safety checks using jsonb\_each\_text() instead of jsonb\_each().


Step 3: Impact Analysis \& Topological Sorting
Investigate to confirm you fully understand everything impacted by these updates. Ensure these changes will not break adjacent modules. Chronologically audit the execution sequence to eliminate circular dependencies. Ensure no frontend component or hook is scheduled to be built before its underlying database tables, triggers, or RPC schemas exist. Reorder the steps to ensure a 100% linear, logical progression where every step exclusively relies on infrastructure built in previous steps. Outline a brief rollback strategy for the core files being modified, ensuring all targeted modifications map explicitly to traceable code paths.


Step 4: Verification Integration
For every new fix added to the plan, define exactly how we will test and verify it works. Before proposing new verification steps, run the existing test suites as a regression baseline:
* `cd designpulse-next && npm test` — Vitest unit + integration (61+ tests)
* `cd designpulse-backend && .\venv\Scripts\python.exe -m pytest tests/ -v` — pytest backend (13+ tests)
If any existing tests fail, flag the regression immediately. Then invoke the modular verify-feature skill requirements to structure the test criteria for the new changes.


Step 5: Review Gate
Present the updated implementation plan using a concise Markdown table mapping: | File Path | Proposed Change | Impacted System | Verification Method |. Explicitly confirm the proposed changes contain no console logs, placeholder comments, or hardcoded test variables. Stop and wait for my explicit approval before writing any code.

