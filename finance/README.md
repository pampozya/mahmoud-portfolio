# Finance Tracker

Private income, expenses, and team payout tracker for single user across multiple devices.

## Features

- **Expenses Tab**: Daily expense tracking by category (DEBT, FIXED OBLIGATIONS, FAMILY, CAR, VARIABLE, LIFESTYLE, ADSENSE)
- **Income Tab**: Project-based income tracking with daily breakdowns
- **Team Payouts**: Ledger for tracking amounts owed to team members (editors, videographers, etc.)
- **Dashboard**: Progress bars for budget tracking, daily spend trend chart, payout summary
- **Cross-device Sync**: Auto-syncs every 30s, manual save on edit, optimistic UI updates
- **Offline Support**: LocalStorage cache + service worker for offline access
- **PWA**: Installable on iOS/Android, works standalone
- **Mobile Responsive**: Table view on desktop, card view on mobile/touch devices

## Data Structure

```json
{
  "month": "2026-05",
  "expenses": {
    "CATEGORY": [
      {
        "id": "item-id",
        "description": "Item Name",
        "expected": 5000,
        "payday": 28,
        "days": [0, 150, 300, ...],  // 31 values
        "paid": 2760,
        "remaining": 2240,
        "percentPaid": 55
      }
    ]
  },
  "income": [
    {
      "id": "income-001",
      "projectName": "Project Name",
      "expected": 5000,
      "payday": 15,
      "days": [...],
      "earned": 2500,
      "remaining": 2500,
      "percentEarned": 50
    }
  ],
  "payouts": [
    {
      "id": "payout-001",
      "projectName": "Project Name",
      "person": "Person Name",
      "role": "Editor",
      "amountOwed": 1000,
      "datePaid": null,
      "status": "owed"  // or "paid"
    }
  ]
}
```

## Deployment

```bash
cd finance/
./deploy.sh
```

Deploys to `https://lensmania.ae/finance/` on Hostinger.

## Local Testing

```bash
cd finance/
python3 -m http.server 8888
# Then visit http://localhost:8888
```

## Files

- `index.html` — Main app with all tabs, modals, charts (41KB, inline CSS+JS)
- `api.php` — JSON file storage API with flock() concurrency safety
- `sw.js` — Service worker (cache-first shell, network-only API)
- `manifest.json` — PWA manifest for iOS/Android install
- `data-seed.json` — Initial data seed (May 2026 expenses from CSV)
- `deploy.sh` — Deployment script to Hostinger via SSH
- `icon-*.png` — PWA icons (192, 512, maskable, apple-touch)

## Hard-Won Lessons Applied

✅ iOS PWA status bar (`apple-mobile-web-app-status-bar-style: black`)
✅ Safe-area insets for notch/home indicator
✅ Ghost-click modal fix (track lastModalOpenedAt, defer classList.add)
✅ Version badge + deploy date for debugging
✅ Service worker VERSION constant for cache busting
✅ Optimistic UI + sync indicator (Syncing / Synced / Error / Offline)
✅ Table-to-card pattern for mobile (@media pointer: coarse)
✅ Touch targets ≥44×44px
✅ flock() on JSON file for write safety
✅ X-Auth token in POST for write barrier
✅ Chart.js from CDN (no build required)

## Token

API write token: `xZwQp8mKL9cVf2nRoJ4tYsH6bGuA5dE` (change if deploying as public tool)

## Pending Tracker Integration

The app polls `/all-pending-tracker-api.php` every 10s to auto-import completed projects as income. This is the only coupling between the two apps — they remain separate systems.
