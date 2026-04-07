# Budget App — Project Specification

## Overview

A personal budget app for tracking and categorising bank transactions in New Zealand. The app syncs bank account data via Akahu into a Google Sheet, which serves as the primary data store. A PWA provides the user interface for viewing and categorising transactions.

The key design decision: Google Sheets is the database. This gives full visibility and manual access to the data outside the app, while the PWA provides a clean mobile-friendly interface for day-to-day use.

## Architecture

```
Akahu API → Firebase Function (scheduled) → Google Sheets ← → PWA (Firebase Hosting)
```

### Components

1. **Firebase Function (Scheduled)** — Runs every 1–2 hours, pulls new transactions from Akahu, deduplicates by transaction ID, and appends to the Google Sheet.
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
| Secrets          | Firebase environment config       |

## Google Sheet Structure


### Sheet: `balances`

| Column | Description | Example |
| --- | --- | --- |
| `account` | Account name or Akahu account ID  | `ANZ Everyday` |
| `description` | name of the account | `Shared personal account` |
| `balance` | Current account balance | `100000` |
| `last_transaction` | last recorded transaction | `2026-04-05` |

### Sheet: `transactions`

| Column | Description | Example |
| --- | --- | --- |
| `id` | Akahu transaction ID (used for dedup) | `trans_abc123` |
| `date` | Transaction date | `2026-04-05` |
| `description` | Raw merchant/payee description | `COUNTDOWN PONSONBY` |
| `amount` | Transaction amount (negative = debit) | `-42.50` |
| `account` | Account name or Akahu account ID | `ANZ Everyday` |
| `category` | User-assigned category (editable via PWA) | `Groceries` |
| `notes` | Optional user notes | `Weekly shop` |

### Sheet: `categories`

| Column | Description | Example |
| --- | --- | --- |
| `name` | Category name | `Groceries` |
| `colour` | Display colour in PWA | `#4CAF50` |
| `budget` | Monthly budget target (optional) | `600` |

### Sheet: `rules` (optional, for auto-categorisation)

| Column | Description | Example |
| --- | --- | --- |
| `pattern` | Substring match on description | `COUNTDOWN` |
| `category` | Category to auto-assign | `Groceries` |

When the sync function appends new transactions, it checks the `rules` sheet and pre-fills the category column for any matches. The user can override these in the PWA.

## Firebase Function — Akahu Sync

### Behaviour

1. Runs on a cron schedule (e.g. every 4 hours).
2. Reads the `_last_sync` metadata (stored as a named range or a cell in a `meta` sheet) to know the most recent transaction date already synced.
3. Calls Akahu `GET /transactions` with a `start` parameter.
4. Filters out any transactions whose `id` already exists in the sheet (belt-and-braces dedup).
5. Applies auto-categorisation rules from the `rules` sheet.
6. Appends new rows to `transactions`.
7. Updates the balances of accounts
7. Updates `_last_sync`.

### Secrets Required

- `AKAHU_APP_TOKEN` — Your Akahu app token.
- `AKAHU_USER_TOKEN` — Your Akahu user token (obtained after OAuth consent).
- `GOOGLE_SHEET_ID` — The ID of the target spreadsheet.

Store these using Firebase environment config:
```bash
firebase functions:secrets:set AKAHU_APP_TOKEN
firebase functions:secrets:set AKAHU_USER_TOKEN
firebase functions:secrets:set GOOGLE_SHEET_ID
```

### Key Dependencies

- `googleapis` — Google Sheets API client.
- `node-fetch` or built-in `fetch` — For Akahu API calls.
- `firebase-functions` — For scheduled function definition.

## PWA — Frontend

### Core Features

1. **Transaction list** — Scrollable list of recent transactions, grouped by date. Shows description, amount, and category badge.
2. **Categorise** — Tap a transaction to assign or change its category. Writes the change back to the sheet immediately.
3. **Monthly summary** — Simple breakdown of spending by category for the current month. Bar chart or similar.
4. **Budget tracking** — If budgets are set in the `categories` sheet, show progress bars for each category.

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
│   │   └── useCategories.ts   # Fetch categories and budgets
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
2. **Google Sheet** — Create a new spreadsheet. Add the `transactions`, `categories`, and `rules` sheets with the column headers listed above. Note the spreadsheet ID from the URL.
3. **Firebase** — Create a Firebase project. Enable Functions (requires Blaze plan for outbound network calls). Enable Hosting.
4. **Service account** — The Firebase default service account email (visible in Firebase console → Project Settings → Service Accounts) needs Editor access to your Google Sheet. Share the sheet with that email address.
5. **Secrets** — Store Akahu and Sheet credentials using `firebase functions:secrets:set`.
6. **Deploy functions** — `cd functions && npm install && cd .. && firebase deploy --only functions`.
7. **PWA** — Set up Google OAuth consent screen (internal use), create OAuth client ID for web. Configure in the PWA's auth module.
8. **Deploy PWA** — `npm run build && firebase deploy --only hosting`.

## Development Workflow

- Run the PWA locally with `npm run dev` (Vite dev server).
- Test Firebase Functions locally with `firebase emulators:start`.
- The Google Sheet is always accessible directly for manual inspection or edits.

## Design Principles

- **Sheets as source of truth** — The app is a UI layer. You should always be able to open the sheet and understand or fix your data directly.
- **Keep it simple** — This is a personal tool, not a product. Avoid over-engineering. No user management, no multi-tenancy, no complex state management.
- **Mobile-first** — The PWA will primarily be used on a phone. Design for touch, small screens, and quick interactions.
- **Idempotent sync** — The Akahu sync must be safe to re-run. Deduplication by transaction ID ensures no duplicates even if the function runs twice or overlaps.