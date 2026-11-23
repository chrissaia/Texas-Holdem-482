# S30 · Get chips from ads

The Iteration 3 story awards virtual chips for viewing an ad. The user story
workbook lists S30 at one point. The branch is `feature/S30-rewarded-ads`.

1. Sign in to RIVR as an authorized administrator. Open your avatar menu
   and choose **Manage ads**, or visit [Manage ads](http://localhost:5173/manage-ads).
   Select **Create ad** and enter a title, format, media file, reward from
   1 to 10,000 chips, and minimum viewing time from 3 to 300 seconds.
   Check **Show this ad to players** and click **Save ad** to publish.
2. Upload a PNG, JPEG, or WebP picture (up to 5 MB and 4096 px), or an MP4 or
   WebM video (up to 25 MB). Use a browser-compatible encode, such as an
   H.264 MP4 with fast start, and set the minimum to match the intended viewing
   time. Video uploads are checked for a matching container signature. The
   browser handles decoding and reports playback errors.
3. Sign in as a registered player in a separate browser session. In the
   [Lobby](http://localhost:5173/lobby), find **Sponsored** near the table filters
   and choose **View ad · Earn … chips**. The viewer opens over the Lobby.
   Wait for the image timer or finish the video and the minimum time, then
   claim. Confirm the wallet updates and the offer is no longer eligible.
   [Rewards](http://localhost:5173/rewards) shows all ads and remaining claims
   directly below the balance and opens the same viewer.
4. In **Daily reward limit** on the Manage ads page, authorized admins can
   set the account-wide daily limit from 1 to 30.
   The default is three until a policy is saved. Set it to one for a quick
   demo with two distinct ads. After claiming one, the other is unavailable
   until 00:00 UTC. Restore the original limit after the demo.
5. To replace an ad, choose **Edit** next to it and upload a replacement.
   Uncheck **Show this ad to players** to take it out of rotation. Edits
   invalidate unfinished playbacks. Replacing media keeps any claim already
   earned for that ad that day.

Superusers can use the editor. Delegated staff need the add and change
permissions for **Rewarded ad** and **Ad reward policy**. The backend checks
permissions and CSRF on every write. Concurrent edits are detected by the ad's
revision. Django admin and the in-app editor share the same upload validation.

Rewards are limited to one claim per ad and the configured total per account
per UTC day. Policy changes affect subsequent claims, including in-progress
sessions. The server issues an account-bound playback token and enforces the
configured minimum duration, campaign revision, expiry, cap, and wallet
ceiling. Starting another ad invalidates an unfinished token. Claims and
wallet updates share the account lock used by other chip flows. A retry of a
successful claim returns its result without crediting the wallet again.

The Lobby shows one active, unclaimed offer while claims remain. Image ads can
show a still preview. Loading a preview or the catalog does not start the
server timer. The player starts a session by choosing the offer and can close
the viewer with its button or Escape. Only a completed claim pays chips.

This is a first-party ads flow. The official UI requires video completion, but
browser signals do not authenticate watch completion or attention to the server.
The server verifies elapsed time and reward eligibility. External ad-provider
verification would require signed completion events. No provider is connected.
Local media uses the existing Django development media route. Deployments must
serve the media storage and support video range requests. Replaced files are
retained in storage and can be cleaned up by the operator after checking use.

Use `docker compose exec backend python manage.py migrate` after switching to
this branch. Run the focused backend suite with
`docker compose exec backend pytest profiles/tests/test_ad_rewards.py -q` and
the focused frontend suite with
`docker compose exec frontend npm test -- src/features/profile/AdRewards.test.tsx`.

See [test results and coverage images](s30-testing/README.md) for the measured
local run.
