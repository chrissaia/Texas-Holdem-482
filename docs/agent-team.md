# RIVR agent team

For the reusable repository agents intended for teammates, use [.agents/README.md](../.agents/README.md). The roles below describe the earlier one-time analysis team; the reusable briefs are organized by teammate instead.

Implementation update: S13 now has a tested form/API. The table rules and access policy were approved after the analysis below. Use [contracts.md](contracts.md) and [the S13 guide](s13-public-tables.md) for current behavior; unresolved findings below describe the earlier planning state.

This team supports the students' existing Sprint 1 ownership. Agents do not take credit for student contributions or change story assignments. Initial assignments are read-only analysis; feature implementation still proceeds one milestone at a time.

## Team and assignments

| Agent | Specialty | Initial assignment | Future implementation boundary |
| --- | --- | --- | --- |
| Coordinator (main assistant) | Architecture and integration | Reconcile the workbook with the sprint plan; integrate specialist findings and maintain contracts | Shared routing/configuration, migration coordination, integration review, documentation |
| `tables_api` | Django models, validation, REST APIs | Analyze Chris's S13 creation and S10 browsing, plus the S11 filtering boundary | Proposed `backend/tables/` models, serializers, services, endpoints, and their tests |
| `identity_rewards` | Identity, permissions, transactional data | Analyze Finn's S1/S2/S4 and Royal's S5/S14/S29 interfaces and handoffs | Account/session contract review; review user migrations, avatar ownership, and atomic chip services with the human owners |
| `ui_quality` | React UI, accessibility, integration testing | Analyze frontend foundations, Kelechi's S23/S35 dependencies, and cross-feature tests | Proposed `frontend/src/features/tables/`, UI tests, and shared component recommendations; review cleanup and theme acceptance with Kelechi |

These are scoped working roles, not claims that different agents inherently have different capabilities. The split separates database/API work, identity/data-integrity reasoning, and browser behavior to reduce overlapping edits. This session supports the coordinator plus three simultaneous specialist agents. Tasks can be reassigned sequentially as dependencies finish.

## Source review

Source: `docs/reference/User_Stories.xlsx`, read without modifying it. Reviewed sheets: **User Stories**, **Tasks**, **Epics**, and **NFR**. There are 37 stories (rows 3–39), 25 epics (rows 3–27), and 11 NFRs (rows 3–13). The Tasks sheet contains headers but no task records.

The sprint plan selects S1, S2, S4, S5, S10, S13, S14, S23, S29, and S35. The workbook is the broader product backlog; its high-priority stories do not automatically expand Sprint 1.

| Human owner | Sprint stories | Agent support |
| --- | --- | --- |
| Chris | S13, S10 | `tables_api` + `ui_quality`, coordinated through agreed API contracts |
| Finn | S2, S1, S4 | `identity_rewards` reviews identity/session boundaries and tests |
| Kelechi | S23, S35 | `ui_quality` reviews themes/cleanup tests; `tables_api` supplies table contracts |
| Royal | S5, S14, S29 | `identity_rewards` reviews avatar/chip interfaces and integration tests |

## Requirements that need agreement

- **Filtering scope:** S10 is public-table visibility (`User Stories!A12:J12`). S11 separately covers filtering and has 1 point (`A13:J13`). Chris's original request includes filtering/sorting, so technical planning includes them, but no agent counts S11 as accepted or changes the sprint points automatically. Sorting behavior is not specified in the workbook.
- **Avatar scope and estimates:** S5 says pick and save an avatar and has 3 points (`A7:J7`); the sprint proposes image upload at 2 points. Upload validation is part of the requested sprint scope, while the estimate remains pending approval.
- **Starting chips:** S14 explicitly requires 1,000 virtual chips, but its estimate is `--` (`A16:J16`). The sprint proposes 1 point; do not present that as approved.
- **Daily rewards:** S29's acceptance text says chips can be claimed "sometimes" (`J31`). Agree on the amount and UTC reset/cooldown rule before implementation.
- **Cleanup:** S23 requires eventual deletion of old empty tables (`J25`). Agree on age threshold, activity updates, authoritative occupancy, and concurrent occupancy checks.
- **Themes:** S35 requires selectable themes (`J37`); the sprint adds at least two and a saved preference. Agree on guest versus account persistence and the shared token contract.
- **Table validation:** S13 permits choosing settings (`J15`) without specifying numeric ranges. Confirm player capacity, buy-in/blind relationships, name rules, host/guest permissions, statuses, and initial occupancy before schema/API implementation.
- **Coverage:** Use Sprint 1's above 80% statement and above 50% branch coverage requirement, superseding the design PDF's 60% baseline. Coverage of foundation code alone is insufficient.

## Work order and deliverables

1. Coordinator records decisions for user/session identity, guest permissions, table fields, occupancy/activity, chip services, and errors in `docs/contracts.md`.
2. `tables_api` prepares the S13/S10 schema/API milestone and acceptance tests. Finn retains account implementation; use real Django session authentication for development rather than an identity bypass.
3. `ui_quality` inspects the relevant Figma frames using the required Figma workflow when frontend implementation begins, then aligns components and forms with the agreed API. No direct Figma inspection is claimed by this analysis.
4. Implement and verify S13 end to end, then S10. Filtering/sorting follows the documented scope decision. Keep gameplay, bots, private tables, and joining-seat behavior outside this milestone.
5. Human owners connect their features through reviewed contracts. Specialist agents review permissions, table-to-cleanup and registration-to-chips integration, and failure cases.
6. Coordinator runs the complete applicable checks, records measured coverage and exclusions, and prepares the teammate handoff.

## Specialist review findings

The three specialists inspected the existing foundation and the workbook independently. No feature code was changed by these reviews.

### Tables and API

There is no tables app yet. The backend specialist's first deliverable should be an agreed contract and PostgreSQL-backed creation/list tests. Include invalid boundaries and types, server-derived host identity, host spoofing rejection, session/CSRF behavior, public-only retrieval, empty results, privacy-safe responses, and create-then-list integration. Table capacity, initial occupancy, status values, activity semantics, and list ordering remain decisions rather than inferred rules.

Reserve `backend/tables/` for the table implementation. Agree on a separate cleanup module with Kelechi before cleanup work begins; both agents must not modify the same service concurrently.

### Identity, avatars, and rewards

The current user model has no unique email constraint, avatar field, balance, starting-grant marker, or daily timestamp. Finn should define email normalization/uniqueness, session responses, guest identity/expiry, and role permissions before dependent features integrate. Royal can work against seeded users while those interfaces stabilize.

Registration and the exactly-once starting-chip grant should succeed or roll back together. Daily claims must atomically update eligibility and balance under concurrent requests. Test retries, simultaneous claims, reset boundaries using server time, registration rollback, and cross-account avatar writes against PostgreSQL where transactions matter. Agree on image formats/limits and actual-image validation before upload implementation.

Finn owns the existing initial user migration; subsequent user changes require coordinated migration dependencies. Avoid parallel modifications to `accounts/models.py`.

### Integration and quality

The frontend is a starter, not a Figma implementation. Shared tokens, accessible forms, responsive layouts, typed API errors, and loading/empty/error states need implementation. Theme tests should verify preference restoration and both themes across each owner's screens. Cleanup tests should cover unauthorized callers, recent/occupied tables, and occupancy changing before deletion.

The existing backend pytest configuration lists only `accounts` and `core`; adding `tables` requires expanding discovery and coverage sources. Vitest has coverage reporting configured, but no feature tests or threshold enforcement yet. Agree on measured scope and separate statement/branch results before adding enforcement. Foundation statement coverage does not establish sprint completion.

## Parallel-work rules

- Assign file ownership before edits. The coordinator handles shared configuration and routing; agents propose changes to those files rather than editing them concurrently.
- Serialize changes to `accounts/models.py` and user migrations. Coordinate table migrations with Chris and dependent cleanup work with Kelechi.
- Each implementation task includes story IDs, permitted files, acceptance checks, dependencies, and explicit exclusions.
- Agents report files changed, actual tests run, results, and unresolved requirements. Read-only reviews make no code-completion claims.
- Do not create commits, push branches, change GitHub story status, or merge work merely because an agent finishes its task. Follow the team's documented Git workflow and preserve student authorship.
- Agents in this session are working assistants, not permanently running services. This document preserves their briefs for later sessions.
