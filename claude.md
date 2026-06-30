# Budget App — Project Specification

## Ways of working

- **Always update `claude.md` and `README.md` before committing.** If a commit changes behaviour, adds a feature, or modifies the sheet structure, update both files to reflect it in the same commit.
- `main` is the stable branch — do not push directly.
- Work on `develop` or feature branches; PR into `develop`, then PR `develop` → `main` to release.
- Merging to `main` triggers GitHub Actions to deploy functions + hosting automatically.

## Overview

A personal budget app for tracking and categorising bank transactions in New Zealand. The app syncs bank account data via Akahu into a Google Sheet, which serves as the primary data store. A PWA provides the user interface for viewing and categorising transactions.

The key design decision: Google Sheets is the database. This gives full visibility and manual access to the data outside the app, while the PWA provides a clean mobile-friendly interface for day-to-day use.

## Architecture

```
Akahu API → Firebase Function (scheduled + HTTP) → Google Sheets ← → PWA (Firebase Hosting)
```

### Components

1. **Firebase Function (Scheduled)** — `syncAkahu` — runs every 4 hours (Pacific/Auckland), pulls new transactions from Akahu (paginated), deduplicates by transaction ID, applies auto-categorisation rules, appends to the sheet, syncs pending transactions, updates balances, and updates the snapshot actuals.
2. **Firebase Function (HTTP)** — `syncAkahuHttp` — same logic as above but triggered on-demand via POST from the PWA. Secured with `x-sync-secret` header.
3. **Google Sheet** — Source of truth for all data.
4. **PWA** — Mobile-first web app. Reads from the sheet via Google Sheets API v4 (authenticated as the user via Google OAuth/GIS). Lets the user assign categories, view summaries, track budgets, and trigger manual syncs.

## Tech Stack

| Component        | Technology                                                        |
|------------------|-------------------------------------------------------------------|
| Bank feed        | Akahu API (NZ bank aggregator)                                    |
| Sync worker      | Firebase Functions v2 (Node.js 20)                               |
| Scheduler        | Firebase Cloud Scheduler (cron)                                   |
| Data store       | Google Sheets API v4                                              |
| Frontend         | React + Vite (PWA)                                               |
| Hosting          | Firebase Hosting                                                  |
| Service worker   | Workbox (via vite-plugin-pwa)                                     |
| Auth (Functions) | Compute Engine default service account                            |
| Auth (PWA)       | OAuth 2.0 PKCE redirect flow (authorization code + client secret) |
| Secrets          | Google Cloud Secret Manager (`firebase functions:secrets:set`)    |
| CI/CD            | GitHub Actions → deploy on push to `main`                        |

## Google Sheet Structure

### Sheet: `transactions`

| Column | Description | Example |
|---|---|---|
| `id` | Akahu transaction ID — prefix `pending_` for unprocessed | `trans_abc123` |
| `date` | Transaction date (YYYY-MM-DD) | `2026-04-05` |
| `description` | Raw merchant/payee description. Pending rows prefixed `[PENDING]` | `COUNTDOWN PONSONBY` |
| `amount` | Transaction amount (negative = debit) | `-42.50` |
| `account` | Akahu account ID (`_account`) | `acc_abc123` |
| `category` | User-assigned category (editable via PWA) | `Groceries` |
| `notes` | Optional user notes | `Weekly shop` |

**Pending transactions:** Akahu's `/transactions/pending` endpoint is called each sync. Pending rows are stored with a `pending_` ID prefix and `[PENDING]` description prefix. They are replaced wholesale each sync (preserving any user-assigned category/notes). When a pending transaction settles, it gets a new Akahu ID — the sync matches it to the pending row by `amount + account` to carry over the category.

### Sheet: `balances`

| Column | Description | Example |
|---|---|---|
| `account` | Human-readable account name | `ANZ Everyday` |
| `description` | Akahu account ID (`_id`) | `acc_abc123` |
| `balance` | Current account balance | `4850.00` |
| `last_transaction` | Date of last recorded transaction | `2026-04-05` |

Cleared and rewritten on every sync.

### Sheet: `categories`

| Column | Description | Example |
|---|---|---|
| `name` | Category name | `Groceries` |
| `colour` | Hex colour used in PWA | `#4CAF50` |
| `budget` | Monthly budget target (optional) | `600` |

### Sheet: `rules`

| Column | Description | Example |
|---|---|---|
| `pattern` | Case-insensitive substring match on description | `COUNTDOWN` |
| `category` | Category to auto-assign | `Groceries` |

Applied when new transactions are appended. User can override in the PWA.

### Sheet: `snapshots`

| Column | Description | Example |
|---|---|---|
| `month` | Month in `YYYY-MM` format | `2026-04` |
| `expected` | Expected total cash-on-hand across all accounts | `26000` |
| `actual` | Actual total — written by the sync function | `25400` |
| `diff` | `actual - expected` — written by the sync function | `-600` |

One row per month. `expected` is filled in manually. Each sync updates `actual` and `diff` for the current month's row using the live sum of all account balances. Past months are frozen once the month rolls over.

### Sheet: `meta`

| Cell | Description | Example |
|---|---|---|
| `B1` | Date of last sync (YYYY-MM-DD) | `2026-04-07` |

## Firebase Function — Akahu Sync

### Behaviour

1. Reads last sync date from `meta!B1`. Looks back 3 days from that date to catch late-arriving transactions. Defaults to 30 days ago on first run.
2. Calls Akahu `GET /transactions` (paginated via cursor) and `GET /transactions/pending`.
3. Calls Akahu `GET /accounts` for current balances.
4. Reads existing transaction IDs and pending rows from the sheet.
5. Filters settled transactions to only new ones (not in existing IDs).
6. For new settled transactions, attempts to match pending rows by `amount + account` to carry over user-assigned category/notes.
7. Applies auto-categorisation rules from the `rules` sheet to any unmatched transactions.
8. Appends new settled transactions.
9. Replaces all pending rows (preserving user-set category/notes by ID).
10. Clears and rewrites the `balances` sheet.
11. Updates `actual` and `diff` in the current month's `snapshots` row.
12. Updates `meta!B1` with today's date.

### Secrets Required

```bash
firebase functions:secrets:set AKAHU_APP_TOKEN    # sent as X-Akahu-Id header
firebase functions:secrets:set AKAHU_USER_TOKEN   # sent as Authorization: Bearer
firebase functions:secrets:set GOOGLE_SHEET_ID    # spreadsheet ID from URL
firebase functions:secrets:set SYNC_SECRET        # shared secret for HTTP endpoint
```

## PWA — Frontend

### Tabs

1. **Transactions** — Scrollable list grouped by date. Debits with no category highlighted red. Shows account name and category. Tap to open category picker.
2. **Summary** — Current month's total spend + total live balance across all accounts. Per-account balance list with this-month spend. Spend breakdown by category with bar chart.
3. **Budget** — Progress bars for each category that has a budget set in the `categories` sheet.
4. **Snapshot** — Monthly cash-on-hand targets vs actuals. Current month uses live balance total; past months show stored actuals. Diff shown per month.

### Header

- **Sync** button — triggers `syncAkahuHttp`, then reloads transactions and balances.
- **Sign out** — clears the OAuth token.

### Technical Details

- React + Vite, TypeScript strict mode.
- Tailwind CSS for styling — dark theme (`bg-slate-900`).
- OAuth 2.0 PKCE redirect flow. Sign-in redirects the page to Google's consent screen; Google redirects back with an authorization code; the app exchanges the code for an access token via `https://oauth2.googleapis.com/token`.
- Sheets API called directly from the PWA using the user's OAuth token — no Firebase Function in the read/write path.
- Workbox service worker for offline app shell caching.
- Safe-area insets handled for notched phones.
- Dates parsed as `new Date(year, month-1, day)` (not `new Date(isoString)`) to avoid UTC-midnight timezone issues in NZ.

## Project Structure

```
BudgetAppV2/
├── firebase.json
├── .firebaserc                        # project: budgetappv2-b7275
├── claude.md                          # this file
├── README.md
├── .github/
│   └── workflows/
│       └── deploy.yml                 # deploy functions + hosting on push to main
│
├── functions/                         # Firebase Functions (Node.js 20 / TypeScript)
│   └── src/
│       ├── index.ts                   # syncAkahu (scheduled) + syncAkahuHttp (HTTP)
│       ├── akahu.ts                   # Akahu API client (paginated, pending)
│       ├── sheets.ts                  # Sheets read/write helpers
│       └── categorise.ts             # Rule matching
│
├── src/                               # PWA (React + Vite)
│   ├── App.tsx                        # Root — auth, tabs, sync trigger
│   ├── types.ts                       # Transaction, Category, Balance, Snapshot
│   ├── index.css                      # Tailwind + safe-area utilities
│   ├── sw.ts                          # Workbox service worker
│   ├── lib/
│   │   ├── auth.ts                    # OAuth 2.0 PKCE redirect flow
│   │   └── sheets.ts                  # Sheets API client
│   ├── hooks/
│   │   ├── useTransactions.ts
│   │   ├── useCategories.ts
│   │   ├── useBalances.ts
│   │   └── useSnapshots.ts
│   └── components/
│       ├── TransactionList.tsx
│       ├── TransactionRow.tsx
│       ├── CategoryPicker.tsx
│       ├── MonthlySummary.tsx
│       ├── BudgetProgress.tsx
│       └── SnapshotTab.tsx
│
├── public/
│   └── icons/                         # icon-192.png, icon-512.png
│
├── vite.config.ts                     # PWA plugin, port 5174
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Environment Variables (`.env.local`)

```
VITE_GOOGLE_CLIENT_ID=<OAuth client ID>
VITE_GOOGLE_CLIENT_SECRET=<OAuth client secret>
VITE_SHEET_ID=<spreadsheet ID>
VITE_SYNC_URL=<deployed syncAkahuHttp URL>
VITE_SYNC_SECRET=<same value as SYNC_SECRET secret>
```

## GitHub Actions Secrets Required

| Secret | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_BUDGETAPPV2_B7275` | Service account JSON (created by `firebase init hosting:github`) |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID |
| `VITE_GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `VITE_SHEET_ID` | Spreadsheet ID |
| `VITE_SYNC_URL` | Deployed HTTP function URL |
| `VITE_SYNC_SECRET` | Sync shared secret |

## Setup Steps

1. **Akahu** — Register a personal app at [my.akahu.nz](https://my.akahu.nz). Connect bank accounts. Note app token and user token.
2. **Google Sheet** — Create a spreadsheet with sheets: `transactions`, `balances`, `categories`, `rules`, `meta`, `snapshots`. Add headers as above. Put an initial date in `meta!B1`.
3. **Firebase** — Create project (Blaze plan). Enable Functions + Hosting. Share the sheet with the Compute Engine default service account as Editor.
4. **Google OAuth** — Enable Sheets API. Create OAuth client ID (Web). Add authorised JavaScript origins and redirect URIs: `http://localhost:5174` and `https://budgetappv2-b7275.web.app`.
5. **Secrets** — Set all four Firebase secrets (see above).
6. **GitHub Actions** — Run `firebase init hosting:github --project budgetappv2-b7275` to create the service account and add it as a GitHub secret. Add the five VITE secrets manually.
7. **Deploy** — Push to `main` — GitHub Actions handles the rest.

## Design Principles

- **Sheets as source of truth** — always inspectable and editable directly.
- **No backend for reads/writes** — PWA calls Sheets API directly with the user's OAuth token.
- **Idempotent sync** — safe to re-run; dedup by transaction ID.
- **Mobile-first** — touch-friendly, dark theme, safe-area aware.
- **Personal tool** — no multi-tenancy, no user management, keep it simple.
