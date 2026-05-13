# Lens Mania — Pending Work Tracker

Self-hosted invoice / payment tracker, deployed to **https://lensmania.ae/all-pending-tracker.html**.
Single-page HTML app + tiny PHP backend storing data in a JSON file on Hostinger.

---

## Files in this folder

| File | What it is |
|---|---|
| `all-pending-tracker.html` | The entire app — HTML, CSS, and JS in one file. **This is what you edit.** |
| `api.php` | PHP endpoint that reads/writes `pending-work-data.json`. GET returns the array, POST replaces it. Write requires `X-Auth` header. |
| `sw.js` | Service worker for PWA / offline cache. Bump `VERSION` constant on every deploy so iPad picks up changes. |
| `manifest.json` | PWA manifest — name, icons, theme color. |
| `tracker-icon-*.png` | App icons (192, 512, 512-maskable, apple-touch-180). |
| `deploy-tracker.sh` | One-command deploy via SSH to Hostinger. **Run after every change.** |
| `README.md` | This file. |

### Related (older Cinemagic-only tracker — kept for reference)
| File | What it is |
|---|---|
| `cinemagic-tracker.html` | Older single-client tracker at https://lensmania.ae/cinemagic-tracker.html |
| `cinemagic-api.php` | PHP backend for the Cinemagic tracker |
| `deploy-cinemagic.sh` | Deploy script for the Cinemagic tracker |
| `cinemagic-tracker.html.backup` | Pre-edit snapshot, kept as a rollback. |

Data file `pending-work-data.json` lives on the server only — never copied here.

---

## How to make a change

1. Edit `all-pending-tracker.html` (or `api.php` for backend, or `sw.js` for caching).
2. **Bump the version** in two places:
   - `sw.js` — change `const VERSION = 'v7';` to `v8`
   - HTML — find `<div class="version-badge">v0.7 · 2026-05-13</div>` and bump it
3. From this folder, run:
   ```bash
   ./deploy-tracker.sh
   ```
4. On iPad/iPhone PWA, tap the "⟳ Reset Cache" button (top-right) to force the new version.
   On any browser, hard-refresh (Cmd+Shift+R / pull-down).

That's the whole loop.

---

## Data model

Each order is a JSON object:
```json
{
  "client": "Cinemagic",
  "project": "RTA Uber",
  "date": "2026-04-01",
  "invoiced": 1500,
  "paid": 500,
  "status": "completed"
}
```

- `status` is the **work state**: `pending` or `completed`.
- Payment state is **derived** from `paid` vs `invoiced`:
  - `paid >= invoiced` → green "Paid"
  - `0 < paid < invoiced` → blue "Partial"
  - `paid == 0` and `status == completed` → orange "Unpaid"
  - `status == pending` → red "Pending"
- The frontend has a `normalize()` function that backfills missing fields when loading legacy data.

---

## API quick reference

```bash
# Read everything
curl https://lensmania.ae/api.php

# Write (requires token — see api.php $TOKEN)
curl -X POST https://lensmania.ae/api.php \
  -H "Content-Type: application/json" \
  -H "X-Auth: oxEUCIkQZ1cAl3bmaDW7ryWSFVvixeiX" \
  -d '[{"client":"Test","project":"Foo","date":"2026-05-13","invoiced":100,"paid":0,"status":"completed"}]'
```

The token is hardcoded in both `api.php` (`$TOKEN`) and `all-pending-tracker.html` (`API_TOKEN`). Rotating means changing both and redeploying.

⚠ The token is visible in the served HTML — it blocks random scanners, not a determined person. For real auth, add `.htaccess` HTTP basic auth.

---

## Server layout (Hostinger)

```
domains/lensmania.ae/public_html/
├── all-pending-tracker.html      ← uploaded by deploy script
├── api.php                       ← uploaded by deploy script
├── manifest.json                 ← uploaded by deploy script
├── sw.js                         ← uploaded by deploy script
├── tracker-icon-*.png            ← uploaded by deploy script
├── pending-work-data.json        ← created on first save, NEVER overwrite manually
└── portfolio/                    ← React portfolio site (different project)
```

SSH credentials are in `deploy-tracker.sh`:
- Host: `145.79.58.45:65002`
- User: `u268111151`
- Key: `~/.ssh/hostinger_key`

---

## Common tasks

### Add a new feature
Just edit the HTML. The JS state lives in `allData` (array of orders). The `normalize()` helper handles new fields gracefully. Bump version + deploy.

### Add a new field to orders
1. Add it to `defaultData` so seeded data has it
2. Add it to `normalize()` so existing records get a sensible default
3. Update `renderTable()` to display it
4. Update Add/Edit forms in the HTML modals to capture it
5. Update form submit handlers to save it

### Reset all data on the server
```bash
curl -X POST https://lensmania.ae/api.php \
  -H "X-Auth: oxEUCIkQZ1cAl3bmaDW7ryWSFVvixeiX" \
  -H "Content-Type: application/json" \
  -d '[]'
```
The frontend will re-seed with `defaultData` on next load.

### Pull current data for backup
```bash
curl https://lensmania.ae/api.php > backup-$(date +%F).json
```

---

## Version history

| Version | What |
|---|---|
| v0.1 | First deploy — basic CRUD + server sync |
| v0.2 | Partial payments (invoiced/paid split) |
| v0.3 | PWA + swipe actions |
| v0.4 | Status bar fix for iOS standalone |
| v0.5 | Version badge |
| v0.6 | Mobile card view |
| v0.7 | Card view on iPad (`pointer:coarse`) + Reset Cache button |
