# Kickstart prompt for the next project

Paste the **block below** into a fresh Claude Code (or Claude.ai) conversation
to start a more complex project with everything we learned baked in.

Fill in the `<<...>>` placeholders before pasting.

---

```
I'm building <<one-line description: what the app does>> for <<who uses it, in
what context>>. I want it deployed to <<domain>>, hosted on Hostinger (same
provider I already use, SSH key at ~/.ssh/hostinger_key, port 65002, user
u268111151).

## Reference project — the simpler one I already shipped

I already shipped a single-page tracker at lensmania.ae/all-pending-tracker.html
using this stack (it works well, copy the patterns):

- One HTML file with inline CSS + JS (Chart.js from CDN for charts)
- One PHP file (`api.php`) that stores data in a flat JSON file with
  flock()-based locking; GET returns the array, POST replaces it
- A bash deploy script that `scp`s the files to Hostinger and ensures the
  JSON data file exists with 664 perms
- Frontend syncs via fetch: optimistic local update, POST to server,
  poll every 30s for cross-device updates
- Cached in localStorage as offline fallback
- Service worker for PWA (shell cache-first, API always network-only)
- 4 PNG icons (192, 512, 512-maskable, 180 apple-touch) + manifest.json

Repo: /Users/mahmoudadel/Documents/mahmoud-portfolio/tracker/
Read tracker/README.md first if you need details.

## Hard-won lessons — apply all of these from day one

### iOS Safari / PWA quirks I already debugged

1. **Status bar style**: `apple-mobile-web-app-status-bar-style` must be `black`
   or `default` (opaque), NOT `black-translucent` — translucent makes content
   flow under the iOS status bar so the top of the page is un-tappable in
   standalone mode.

2. **Ghost click on modals**: tapping a button that shows a modal causes iOS
   to synthesize a second click ~300ms later at the same coordinates, which
   hits the newly-shown modal backdrop and closes it instantly. Fix:
   - Track `lastModalOpenedAt = Date.now()` when opening
   - Ignore backdrop-close clicks within 400ms of that timestamp
   - Defer the actual `classList.add('active')` by one `requestAnimationFrame`
     so the click event finishes bubbling first

3. **Safe-area insets**: use `viewport-fit=cover` + `padding: max(20px,
   env(safe-area-inset-top))` (and right/bottom/left) so PWA respects the
   notch / home indicator.

4. **iOS Safari has no `beforeinstallprompt`**: detect with
   `/iPad|iPhone|iPod/.test(navigator.userAgent)` + check
   `window.navigator.standalone === true` for installed state. Show a manual
   "Share → Add to Home Screen" alert as the fallback install button.

5. **Service worker won't update in PWA**: bump a `VERSION` constant in
   `sw.js` on every deploy. Also add a user-facing "⟳ Reset Cache" button
   inside the PWA that calls `caches.keys()` + `caches.delete()` +
   `serviceWorker.getRegistrations()` + `unregister()` + reload. Standalone
   mode doesn't have the browser refresh button.

6. **Always show the deployed version** as a small fixed badge top-right
   (e.g. `v0.7 · 2026-05-13`). Saved me hours of "did my fix deploy" debugging.

### Mobile/touch UX

7. **Don't put 7-column tables on phones**. Use the table-to-card pattern via
   CSS: `display: block` on tr/td, hide thead, and `td::before { content:
   attr(data-label); }` for inline labels. Render `data-label` on every td.

8. **Card view trigger**: use `@media (max-width: 768px), (pointer: coarse)`
   so the card view applies to ALL touch devices (phones AND iPads in any
   orientation), not just narrow screens. Mac/PC with mouse keeps the table.

9. **Touch targets ≥44×44px** for action buttons. Tiny `<button>`s with
   `padding: 4px 6px` work on desktop but are unusable on iPad.

10. **Swipe actions on rows**: track touchstart X, lock to horizontal axis if
    `|dx| > |dy|`, translate `td`s with `translateX(dx)`, reveal action
    backgrounds via `::before` / `::after` with opacity transitions, commit
    if released past 35% of row width. Guard with `if (e.target.closest(
    '.action-btn, .status-badge')) return` so taps on buttons still work.

### Data / sync

11. **Don't try real-time WebSockets on Hostinger shared PHP**. The
    optimistic-write + 30s-poll pattern is good enough for personal/team
    tools. Suppress polling briefly (5s) right after a local write to avoid
    a re-fetch overwriting in-flight changes.

12. **Migration via `normalize()` on the client**: when changing the data
    shape, add a `normalize(record)` function that backfills missing fields.
    Run it on every load. The next save persists the new shape. No server-
    side migration needed.

13. **Optimistic UI**: render the local change immediately, then POST. Show a
    sync indicator (Syncing / Synced / Error). Keep the last good state in
    localStorage as offline cache.

### Backend security

14. **The `X-Auth` shared-token pattern in `api.php`** is fine for personal
    tools — it blocks random scanners. But the token is visible in the HTML
    source, so it's NOT real auth. For anything multi-user or sensitive, add
    `.htaccess` HTTP basic auth OR build a real session/cookie login.

15. **flock() on the JSON file** is essential — without it, two concurrent
    POSTs can corrupt the file. Use LOCK_SH for reads, LOCK_EX for writes,
    ftruncate before rewriting.

### Process

16. **Incremental deploys**: ship one risky change at a time, verify, then
    the next. Don't bundle data-model changes with UI changes — if something
    breaks you want a clean rollback target.

17. **Server-side one-time migrations**: when changing the data model and
    real data already exists on the server, write a curl + Python one-liner
    to fetch / transform / POST the migrated data. Don't ask the frontend
    to handle data from two schemas in production.

18. **Hard-refresh on iPad is not a hard-refresh** — Safari + the service
    worker can serve stale shells for a long time. Always include the
    in-app Reset Cache button + version badge so you can confirm what's
    actually running.

## What's different about this new project

<<Describe the new project here. Be concrete:
 - Who are the users? How many?
 - Multi-user / auth required?
 - Data scale? Many records, large records, attachments?
 - Real-time needs?
 - Offline-first?
 - Specific integrations (calendar, accounting, email)?
 - Anything you DON'T want done the same way as the simple tracker?>>

## Start by asking me

Before writing code, ask me 2-4 clarifying questions in one batch (use the
AskUserQuestion tool with multiple questions). Cover: data model, auth/
multi-user, what platforms (which devices/browsers), and whether to start
from the tracker patterns or something different given the scale.

Then propose an architecture and a phased deploy plan. Don't start writing
code until I confirm.
```

---

## Bonus tips for the next conversation

- **Tell Claude up front to bump the version + redeploy** after every edit so you
  always know what's live. Otherwise it'll forget mid-conversation.
- **Keep `~/.ssh/hostinger_key` permissions at 600** — Claude may need to
  re-run `chmod 600` if it ever gets reset.
- **If the project gets multi-user**, drop the shared-token model on day one.
  Adding real auth retroactively is painful (we deferred it twice in the
  tracker and it never got built).
- **Don't put credentials/tokens in committed files** for anything serious. The
  tracker token is in git because it's already exposed in the served HTML
  anyway — that's the only reason it's safe.
