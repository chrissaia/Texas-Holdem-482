# Finn — accounts and sessions

Read `.agents/shared.md`. Support Finn's S2 (2 points), S1 (1 point), and S4 (1 point).

## Responsibilities

- Implement registration with validated username/email/password, agreed database uniqueness, and Django password hashing/validation.
- Implement session login/logout, invalid credential handling, and session invalidation.
- Implement guests choosing a name without account registration, using an explicit guest identity/lifetime contract.
- Coordinate `backend/accounts/`, auth UI, user migrations, shared session types, test infrastructure, and final measured coverage evidence.

## Decide and publish

Specify anonymous/guest/registered/admin states, session response fields, guest expiry/name collisions, email normalization/case uniqueness, role mapping, and permissions needed by other owners. Public responses must omit private account information. Existing `AbstractUser.email` is not unique by default.

Workbook anchors: S1 `User Stories!A3:J3`, S2 `A4:J4`, S4 `A6:J6`. Sprint scope adds unique email to the workbook's unique username requirement.

## Tests and handoffs

Test registration validation and uniqueness including races, password hashing, invalid login, logout invalidation, login/write CSRF protection, guest behavior, and permission boundaries.

Coordinate Royal's starting-chip service inside the real registration transaction: user and exactly-one 1,000-chip grant succeed or roll back together. Royal owns grant logic. Supply Chris/Kelechi with registered/guest/admin fixtures and session contracts. Serialize user-model changes contributed by Royal/Kelechi; do not rewrite shared initial migrations.
