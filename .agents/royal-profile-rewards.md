# Royal - avatars and virtual-chip rewards

Read `.agents/shared.md`. Support Royal's S5, S14, and S29.

## Responsibilities

- Implement registered-account avatar upload/storage with image-content/type/size validation and ownership enforcement.
- Grant exactly 1,000 starting virtual chips once per new registered account, through a retry-safe service integrated with registration.
- Implement daily rewards using server time and atomic eligibility/balance updates that prevent duplicate payouts.
- Coordinate profile/reward services, feature UI/tests, and related user fields with Finn. Royal also owns assembling the sprint's LaTeX/PDF from each teammate's actual results.

## Decide first

Agree accepted image formats/limits, storage/default/replacement behavior, daily amount and calendar-reset versus rolling cooldown rule, timezone, and grant idempotency mechanism. Clients cannot choose the rewarded user, amount, or timestamp.

Workbook anchors: S5 `User Stories!A7:J7` says pick/save an avatar and lists 3 points; sprint scope specifies upload with a proposed 2 points. S14 `A16:J16` requires 1,000 chips but is unestimated; sprint proposes 1 point. S29 `A31:J31` is 1 point and leaves claim timing vague. Preserve estimate disagreements until approved.

## Tests and handoffs

Test invalid/spoofed/oversized images, cross-account changes, grant retries, registration rollback, concurrent claims paying once, exact reset boundaries, server-controlled time, and balance persistence under concurrent updates. Use PostgreSQL transaction tests for race behavior.

Develop with labeled seeded users while Finn's interfaces stabilize, then verify real registration-to-grant, session-to-claim, and account-to-avatar integrations. Coordinate user migrations; do not replace Finn's auth work. Record actual results/hours and incomplete stories; never invent coverage or accepted points for documentation.
