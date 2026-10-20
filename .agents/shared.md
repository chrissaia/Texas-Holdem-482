# Shared RIVR working instructions

## Read the current project

- Read `instructions.md` and `docs/contracts.md`, then inspect the existing implementation and Git status before editing. Preserve unrelated local work.
- Consult `docs/reference/User_Stories.xlsx` for the requested stories and `docs/reference/CS495_Project_System_Design.pdf` for architecture. `docs/agent-team.md` records planning findings and unresolved requirements; it does not prove features are implemented.
- Use React/TypeScript/Vite/React Router, Django/REST Framework/ORM, PostgreSQL, Vitest, and pytest/pytest-django. Add Channels only when real-time functionality is needed.
- Use the actual Figma design when implementing screens. Follow the available tool's required skill/workflow. If inaccessible, identify the limitation and use available references; never claim an inspection that did not happen.

## Work one milestone at a time

Explain the next milestone, implement the user's requested work, show exact paths and run/test commands, and report observed results. Stop at a logical milestone for the student's confirmation before starting the next. Explain important decisions so the student can understand and maintain the code.

Do not implement unrelated teammates' stories merely to satisfy a dependency. Define contracts and clearly identified development fixtures, then verify the real integration when available. Keep gameplay, bots, messaging, leaderboards, tournaments, private-table flows, and monetization outside Sprint 1 unless separately requested.

## Shared boundaries

- Finn coordinates `accounts.User`, identity/session contracts, and user migration order. Use `settings.AUTH_USER_MODEL` or `get_user_model()` for user references. Keep applied/shared migrations intact.
- Chris coordinates table models, settings, occupancy/activity contracts, and table migrations. Kelechi's cleanup consumes authoritative occupancy/activity.
- Royal coordinates avatar and chip fields/services. Starting grants and reward updates must be server-controlled and atomic.
- Coordinate changes to shared settings, URL routing, frontend entrypoints, design tokens, and contracts before concurrent edits. Roles are coordination boundaries, not prohibitions against necessary changes requested by the user.
- Keep authentication and CSRF checks intact. Derive ownership from the authenticated request. Never introduce production identity bypasses or expose secrets/private account fields.
- Record unresolved acceptance rules rather than silently treating guesses as approved requirements. Make routine implementation choices within the agreed contract.

## Tests and handoff

Follow the current commands in `instructions.md`. Add tests for successful behavior, invalid input, permissions, and relevant integration failures. Use PostgreSQL transaction tests for concurrency-sensitive behavior. Include new apps in test discovery and coverage sources.

Sprint targets are above 80% statement coverage and above 50% branch coverage, aiming for 85% and 55%. Measure and report scope; never fabricate results or present foundation coverage as feature completion. jsdom tests do not establish visual or real-browser compatibility.

Use feature branches and descriptive story/task/actual-issue commit messages. Only commit or push when requested; preserve student authorship. Never commit `.env`, dependencies, virtual environments, or local database data. Professor acceptance alone moves a story to Done.

Finish with files changed, behavior added, actual checks run, remaining gaps, and the next handoff. Do not claim a story accepted based on agent completion.
