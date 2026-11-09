# S16: Save chip balance

## Story record

- Planned owner: Kelechi.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A18:M18`.
- Workbook points: 2; planned sprint points: 2.
- Priority: High; epic: E10; NFR references: NFR4, NFR6, NFR11.
- Tracked issue: [#30](https://github.com/chrissaia/Texas-Holdem-482/issues/30).

**User story:** as a player, i want my chip wins and losses to save, so that my balance stays correct.

**Workbook acceptance target:** done when chip balances should update correctly.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## S16 persistence implementation

Implemented a server-side save service and durable receipt table on
feature/S16-save-chip-balance. This implements the S16 balance-persistence component. The separately planned
poker engine is not implemented here; professor acceptance remains pending.

Existing starting/daily rewards and accounts.User.chip_balance remain the shared
balance infrastructure. No account field or reward-policy migration was changed.
The chips.0001_initial migration adds only the receipt table and its constraints.

### Trusted game integration

Use chips.services.save_chip_result(user_id, source=..., delta=...) from trusted
backend game/settlement code. Positive deltas add chips, negative deltas subtract
chips, and zero records a no-change result. The caller derives the account,
signed integer delta, and stable result ID from authoritative game data.

The result ID is unique per account. It is 1-100 characters, case-sensitive, with
no surrounding whitespace. A retry with the identical delta is a no-op and
returns the current account balance; a different delta for the same ID fails.
Historical balance_after on the receipt is not replayed over later rewards.

The result service and existing reward services all lock the same account row.
Account update and receipt insert commit or roll back together. Balances cannot
become negative or exceed 9,007,199,254,740,991. Inactive accounts and guest user
markers are rejected; session-only guests have no registered account ID.

There is no browser endpoint for submitting winnings, losses, a balance, or
another user's ID. The existing private GET /api/profile/ reads the persisted
balance, and existing /rewards and app-shell displays show it after refresh.

The caller must:
- Compute deltas from verified results, not from a browser's claim.
- Decide whether a result changes the account wallet or a reserved table stack.
  Do not deduct a loss twice after buy-in or credit money still reserved at a table.
- Use a stable source, for example a persisted hand/settlement ID, for every retry.
- For multi-player settlement, use one outer transaction and acquire participant
  account locks in ascending ID order. Validate conservation/payout rules in the
  game engine before saving any participants.
- Coordinate eligible in-progress games if an account becomes inactive.
- Call the progression/stats hooks only for their own appropriate real events.
  Saving chip receipts alone does not implement XP, poker outcomes, or S17 stats.

The service returns SavedChipResult(result_id, chip_balance, applied).
Expected errors are ValueError for invalid input, User.DoesNotExist for an unknown
account, PermissionDenied for inactive/guest-marked accounts, InsufficientChips
for underflow, ChipBalanceLimit for overflow, and ConflictingChipResult for an
altered retry. A failure leaves both balance and receipts unchanged.

### Inspection and demo

Run migrations after pulling:
docker compose exec backend python manage.py migrate

Administrators with normal view permission can inspect Chips > Chip results at
/admin/chips/chipresult/. Receipts cannot be added, edited, or deleted there.
A developer with direct database/shell access is trusted infrastructure; this
is not a player-accessible chip editor.

A development-only smoke test can call the service for an explicitly designated
demo account from manage.py shell, then inspect its profile balance and log out/
back in. These are labelled synthetic results; they are not proof of real gameplay.
Automated tests already perform persistence checks through real account APIs and
test accounts in a separate PostgreSQL test database.

### Verification

Focused tests:
docker compose exec backend pytest chips/tests/test_results.py -v

The tests cover signed wins/losses/zero changes, exact limits, invalid inputs,
same-result retries, conflicting retries, multiple players' account isolation,
receipt database constraints, failure rollback, multi-account transaction rollback,
real logout/login restoration, private profile reads, rejected browser chip writes,
read-only admin receipts, and simultaneous result/result or result/reward writes.

## Team gameplay integration handoff

No authoritative game engine or table-reservation/settlement service exists in the
inspected checkout. Connecting this save service to completed hands/cash-outs and
demonstrating real game wins/losses remains a team integration dependency.
The isolated S16 acceptance checks use explicit server-generated test results;
they do not demonstrate a played poker hand.
This milestone does not implement S15 seating/buy-in or S17 statistics.

Record actual hours, the implementation commit, final full-scope test evidence,
and the professor's acceptance separately. No accepted points are claimed.


## Measured results for this working-tree milestone

- S16-focused PostgreSQL suite: 49 passed.
- Full backend suite: 462 passed. Full configured scope: 1,095/1,114 statements
  (98.29%) and 237/244 branches (97.13%).
- New chips module: 65/65 statements and 16/16 branches covered (100% each).
- Frontend regression suite: 135 passed. Full configured scope: 696/721
  statements (96.53%) and 538/580 branches (92.75%).
- Django system check, migration drift check, frontend build, lint, and Git
  whitespace check passed. chips.0001_initial was generated and applied locally.
- Real browser smoke check with an explicitly labelled development account:
  1,000 starting chips, a synthetic +250 result, an identical retry (no second
  payout), and a synthetic -100 result left 1,150 chips. The existing rewards
  screen retained 1,150 after refresh and a real logout/login. No JavaScript page
  errors occurred. The temporary account, receipts, and credentials were removed.
  This verifies persistence and display, not a real played poker hand.

Backend full-scope JSON/XML/JUnit reports for this run were generated in the
container under /tmp/s16-backend-report.json, /tmp/s16-backend-report.xml and
/tmp/s16-backend-tests.xml, with HTML in backend/htmlcov. Frontend raw reports are
under frontend/coverage. These are local, uncommitted working-tree measurements.

Do not replace final team evidence with a feature-only image. After the source
is reviewed and committed, follow docs/quality/README.md and rerun/export the
full release evidence with its actual source manifest. This milestone did not
commit, push, or claim hosted CI/professor acceptance.
