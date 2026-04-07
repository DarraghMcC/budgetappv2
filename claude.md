# Budget App — Project Specification

## Overview

A personal budget app for tracking and categorising bank transactions in New Zealand. The app syncs bank account data via Akahu into a Google Sheet, which serves as the primary data store. A PWA provides the user interface for viewing and categorising transactions.

The key design decision: Google Sheets is the database. This gives full visibility and manual access to the data outside the app, while the PWA provides a clean mobile-friendly interface for day-to-day use.

## Architecture

```
Akahu API → Firebase Function (scheduled) → Google Sheets ← → PWA (Firebase Hosting)
```

### Components

1. **Firebase Function (Scheduled + HTTP)** — Runs every 4 hours (Auckland timezone), pulls new transactions from Akahu, deduplicates by transaction ID, and appends to the Google Sheet. Also exposes an HTTP endpoint for on-demand sync, secured with a shared secret header (`x-sync-secret`).
2. **Google Sheet** — Source of truth for all transaction data and category assignments.
3. **PWA** — Mobile-first web app hosted on Firebase Hosting. Reads transactions from the sheet, lets the user assign/edit categories, and writes changes back.

## Tech Stack

| Component        | Technology                        |
| ---------------- | --------------------------------- |
| Bank feed        | Akahu API (NZ bank aggregator)    |
| Sync worker      | Firebase Functions (Node.js)      |
| Scheduler        | Firebase Cloud Scheduler (cron)   |
| Data store       | Google Sheets API v4              |
| Frontend         | React + Vite (PWA)                |
| Hosting          | Firebase Hosting                  |
| Service worker   | Workbox                           |
| Auth (Sheets)    | Firebase default service account  |
| Secrets          | Google Cloud Secret Manager (via `firebase functions:secrets:set`) |

## Google Sheet Structure


### Sheet: `balances`

| Column | Description | Example |
| --- | --- | --- |
| `account` | Human-readable account name | `ANZ Everyday` |
| `description` | Akahu account ID (`_id`) | `acc_abc123` |
| `balance` | Current account balance | `100000` |
| `last_transaction` | last recorded transaction | `2026-04-05` |

### Sheet: `transactions`

| Column | Description | Example |
| --- | --- | --- |
| `id` | Akahu transaction ID (used for dedup) | `trans_abc123` |
| `date` | Transaction date | `2026-04-05` |
| `description` | Raw merchant/payee description | `COUNTDOWN PONSONBY` |
| `amount` | Transaction amount (negative = debit) | `-42.50` |
| `account` | Akahu account ID (`_account`) | `acc_abc123` |
| `category` | User-assigned category (editable via PWA) | `Groceries` |
| `notes` | Optional user notes | `Weekly shop` |

### Sheet: `categories`

| Column | Description | Example |
| --- | --- | --- |
| `name` | Category name | `Groceries` |
| `colour` | Display colour in PWA | `#4CAF50` |
| `budget` | Monthly budget target (optional) | `600` |

### Sheet: `meta`

| Cell | Description | Example |
| --- | --- | --- |
| `B1` | Last sync date (updated after each sync) | `2026-04-06` |

### Sheet: `rules` (optional, for auto-categorisation)

| Column | Description | Example |
| --- | --- | --- |
| `pattern` | Substring match on description | `COUNTDOWN` |
| `category` | Category to auto-assign | `Groceries` |

When the sync function appends new transactions, it checks the `rules` sheet and pre-fills the category column for any matches. The user can override these in the PWA.

## Firebase Function — Akahu Sync

### Behaviour

1. Runs on a cron schedule every 4 hours (Pacific/Auckland timezone), or on-demand via HTTP POST with `x-sync-secret` header.
2. Reads the last sync date from cell `B1` of the `meta` sheet. Defaults to 30 days ago on first run.
3. Calls Akahu `GET /transactions` with a `start` parameter, following pagination cursors to fetch all results.
4. Fetches Akahu `GET /accounts` for current balances.
5. Filters out any transactions whose `id` already exists in the sheet (belt-and-braces dedup).
6. Applies auto-categorisation rules from the `rules` sheet.
7. Appends new rows to `transactions`.
8. Clears and rewrites the `balances` sheet.
9. Updates `meta!B1` with today's date.

### Secrets Required

- `AKAHU_APP_TOKEN` — Your Akahu app token (sent as `X-Akahu-Id` header).
- `AKAHU_USER_TOKEN` — Your Akahu user token (sent as `Authorization: Bearer` header).
- `GOOGLE_SHEET_ID` — The ID of the target spreadsheet.
- `SYNC_SECRET` — Shared secret for authenticating HTTP sync requests.

Store these using Firebase Secret Manager:
```bash
firebase functions:secrets:set AKAHU_APP_TOKEN
firebase functions:secrets:set AKAHU_USER_TOKEN
firebase functions:secrets:set GOOGLE_SHEET_ID
firebase functions:secrets:set SYNC_SECRET
```

### Key Dependencies

- `googleapis` — Google Sheets API client.
- Built-in `fetch` — For Akahu API calls.
- `firebase-functions` — For scheduled and HTTP function definitions.

## PWA — Frontend

### Core Features

1. **Transaction list** — Scrollable list of recent transactions, grouped by date. Shows description, amount, account name, and category. Rows missing a category are highlighted in red.
2. **Categorise** — Tap a transaction to assign or change its category. Writes the change back to the sheet immediately.
3. **Monthly summary** — Simple breakdown of spending by category for the current month.
4. **Budget tracking** — If budgets are set in the `categories` sheet, shows progress bars for each category.
5. **Manual sync** — "Sync" button in the header triggers an immediate Akahu sync via the HTTP function.

### Technical Details

- Built with React + Vite.
- Uses Google Sheets API v4 directly from the client for reads and writes.
- Authentication: Google OAuth2 (personal account) — the sheet is private, so the PWA authenticates as you.
- Service worker via Workbox for offline app shell caching (data itself requires network).
- Manifest configured for standalone display mode, themed appropriately.

### Sheets API Access from PWA

The PWA authenticates via Google OAuth (using the same Google account that owns the sheet). Use `gapi` or the Google Identity Services library to get an access token, then call the Sheets API directly. No Firebase Function needed in the read/write path — the function is only for the Akahu sync.

## Project Structure

```
budget-app/
├── firebase.json              # Firebase config (hosting + functions)
├── .firebaserc                # Firebase project alias
├── claude.md                  # This file
│
├── functions/                 # Firebase Functions
│   ├── package.json
│   ├── src/
│   │   ├── index.ts           # Function entry point (scheduled sync)
│   │   ├── akahu.ts           # Akahu API client
│   │   ├── sheets.ts          # Google Sheets read/write helpers
│   │   └── categorise.ts      # Auto-categorisation rule matching
│   └── tsconfig.json
│
├── src/                       # PWA source (React + Vite)
│   ├── main.tsx               # App entry
│   ├── App.tsx                # Root component and routing
│   ├── components/
│   │   ├── TransactionList.tsx
│   │   ├── TransactionRow.tsx
│   │   ├── CategoryPicker.tsx
│   │   ├── MonthlySummary.tsx
│   │   └── BudgetProgress.tsx
│   ├── hooks/
│   │   ├── useTransactions.ts # Fetch/update transactions via Sheets API
│   │   ├── useCategories.ts   # Fetch categories and budgets
│   │   └── useBalances.ts     # Fetch account balances
│   ├── lib/
│   │   ├── sheets.ts          # Sheets API wrapper
│   │   └── auth.ts            # Google OAuth setup
│   ├── types.ts               # Shared TypeScript types
│   └── sw.ts                  # Service worker (Workbox)
│
├── public/
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # App icons
│
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Setup Steps

1. **Akahu** — Register a personal app at https://my.akahu.nz. Connect your bank accounts. Note your app token and user token.
2. **Google Sheet** — Create a new spreadsheet. Add the `transactions`, `categories`, `rules`, `balances`, and `meta` sheets with the column headers listed above. In the `meta` sheet put a start date in cell `B1` (e.g. `2026-01-01`). Note the spreadsheet ID from the URL.
3. **Firebase** — Create a Firebase project. Enable Functions (requires Blaze plan for outbound network calls). Enable Hosting.
4. **Service account** — Firebase Functions v2 runs as the **Compute Engine default service account** (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`), not the Firebase Admin SDK account. Find it in Google Cloud Console → IAM & Admin → Service Accounts and share the Google Sheet with it as Editor.
5. **Secrets** — Store all four secrets using `firebase functions:secrets:set` (see Secrets Required above).
6. **Deploy functions** — `cd functions && npm install && cd .. && firebase deploy --only functions`.
7. **PWA** — Set up Google OAuth consent screen (internal use), create OAuth client ID for web. Configure in the PWA's auth module.
8. **Deploy PWA** — `npm run build && firebase deploy --only hosting`.

## Development Workflow

- Run the PWA locally with `npm run dev` (Vite dev server on port 5174).
- Test Firebase Functions locally with `firebase emulators:start`.
- The Google Sheet is always accessible directly for manual inspection or edits.
- After deploying functions, copy the `syncAkahuHttp` URL from the deploy output into `.env.local` as `VITE_SYNC_URL`.
- `.env.local` is gitignored — set `VITE_SYNC_SECRET` to match the `SYNC_SECRET` Firebase secret.

## Design Principles

- **Sheets as source of truth** — The app is a UI layer. You should always be able to open the sheet and understand or fix your data directly.
- **Keep it simple** — This is a personal tool, not a product. Avoid over-engineering. No user management, no multi-tenancy, no complex state management.
- **Mobile-first** — The PWA will primarily be used on a phone. Design for touch, small screens, and quick interactions.
- **Idempotent sync** — The Akahu sync must be safe to re-run. Deduplication by transaction ID ensures no duplicates even if the function runs twice or overlaps.


### Git workflow
- `main` is the stable branch — do not push directly
- Work on `develop` or feature branches
- PR into `develop`, then PR `develop` → `main` to release
