# S35 iteration 1: selectable themes

## Story record

- Planned owner: Kelechi.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A37:M37`.
- Workbook points: 2; planned sprint points: 2.
- Priority: Low; epic: E23; NFR references: NFR9, NFR10.
- Tracked issue: [#13](https://github.com/chrissaia/Texas-Holdem-482/issues/13).

**User story:** as a player, i want to change the game theme, so that i can change how the game looks.

**Workbook acceptance target:** done when players can pick different themes.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Feature guide

This file records historical feature-stage checks. Use [current full-application evidence](../../quality/README.md) for release coverage; these earlier percentages are not the current team-wide result.

Open /settings using Settings in the navigation (also available in the mobile header).
Choose Dark navy or Light. Shared CSS variables update the home, lobby, create-table,
detail, and settings screens. Dark navy retains the existing Figma palette.

The Appearance theme control follows Figma file Rpni0LkJsoCyH7MSfLUKgb, node
26:3310. The light palette is a new implementation choice pending visual review;
the reference inspected has no separate light palette. Card styles and other
appearance controls are outside this milestone.

Storage uses localStorage key rivr.theme with dark/light values. Dark is the
default for missing, invalid, or unreadable values. The preference belongs to this
browser and is shared by guests and signed-in users: signing out or changing
accounts does not reset it. It does not sync across devices or save to accounts.
If saving fails, the theme still changes for the current page session and Settings
explains that it could not be saved.

Try both themes, navigate between screens, refresh, and reopen the browser.
Check keyboard access to Settings and the native Theme dropdown, focus outlines,
form validation errors, notices, and narrow layouts. Remove or alter rivr.theme
in browser storage to check the fallback.

Run frontend checks using the repository Docker workflow:
docker compose exec frontend npm run build
docker compose exec frontend npm run lint
docker compose exec frontend npm run test:coverage

Professor acceptance is pending; this guide does not claim story acceptance.

## Verification of iteration 1

- Frontend build passed; lint reported zero warnings/errors.
- All 50 frontend tests passed, including 11 new theme tests.
- Configured frontend coverage: 98.18% statements, 92.34% branches.
  Theme modules: 95.65% statements, 90% branches. This does not measure backend
  coverage or establish professor acceptance.
- Headless Microsoft Edge: settings, home, lobby, and create-table pages in both
  themes at widths 1440, 768, 390, and 320 (32 route/theme/size checks).
  No page-level horizontal overflow, broken images, or JavaScript page errors.
- Checked native dropdown keyboard selection, refresh restoration, invalid-value
  fallback, and Settings navigation visibility at each tested width.
- Visually inspected desktop Settings in both themes and the light mobile
  create-table layout. Form validation in both themes was checked with a
  browser-only registered-session fixture: invalid name received focus, an error
  border, and a visible focus outline. No accounts or tables were created.
- Live API health returned status ok and database ok after containers were
  recreated using the Downloads checkout.

Remaining review: approve the proposed light palette and try both themes in your
normal browser. Real account sign-in/sign-out was not browser-tested; theme state
does not consume account identity, and unit tests cover anonymous/registered
session-shaped contexts. Cross-device preference syncing is outside this scope.


## Integration with updated main

Resolved the App.tsx routing conflict with main's account screens by retaining
their standalone layout and wrapping all routes in ThemeProvider. Settings stays
inside AppLayout. Added a light-mode value for main's new --faint text token.

After integration, build and lint passed and all 78 frontend tests passed.
Configured frontend coverage measured 98.34% statements and 93.55% branches;
theme modules remained at 95.65% statements and 90% branches.

Headless Edge checked login, register, and guest routes in both themes (six
combinations), their standalone layout, navigation back to Settings, and theme
persistence. No JavaScript page errors occurred. These browser checks did not
submit real account forms. Restarted the frontend to clear stale Vite source
after the merge.
