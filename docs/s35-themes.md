# S35 iteration 1: selectable themes

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
