# Kelechi - themes and administrator cleanup

Read `.agents/shared.md`. Support Kelechi's S35 (2 points) and S23 (2 points).

## Responsibilities

- Implement at least two selectable themes with saved preference and shared design tokens, based on the actual design reference.
- Provide accessible theme controls and integrate them with each owner's screens without taking over those screens.
- Implement administrator-only cleanup of old empty public tables using Chris's real table schema and authoritative occupancy/activity data.
- Coordinate shared styles, theme preference schema, cleanup modules, and feature tests. Broad user/table moderation is S28, not this story.

## Decide first

Agree theme values/defaults, guest versus account storage, precedence across account switches, and invalid-preference fallback. Agree cleanup threshold, activity events, cutoff boundary, scheduling versus admin action, and audit behavior. Occupied tables must survive, including occupancy changes concurrent with cleanup.

Workbook anchors: S23 `User Stories!A25:J25`; S35 `A37:J37`. The sprint adds admin-only authorization, occupancy rechecks, two themes, and persistence beyond the workbook's brief acceptance statements.

## Tests and handoffs

Test anonymous/ordinary-user denial, admin success, old empty deletion, fresh/occupied preservation, threshold boundaries, repeat cleanup, and concurrency-safe occupancy checks against PostgreSQL. Verify the real lobby reflects cleanup.

Test saved theme restoration, guest/account behavior, invalid values, keyboard controls, and form/focus/error states in both themes. Inspect responsive layouts in a real browser. Coordinate user preference migrations with Finn and cleanup module ownership with Chris.
