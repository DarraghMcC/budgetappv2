import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getTransactions, getPendingTransactions, getAccounts } from './akahu';
import {
  getExistingIds,
  getExistingPendingRows,
  getLastSync,
  setLastSync,
  getRules,
  appendTransactions,
  replacePendingTransactions,
  updateBalances,
} from './sheets';
import { applyRules } from './categorise';

const AKAHU_APP_TOKEN = defineSecret('AKAHU_APP_TOKEN');
const AKAHU_USER_TOKEN = defineSecret('AKAHU_USER_TOKEN');
const GOOGLE_SHEET_ID = defineSecret('GOOGLE_SHEET_ID');
const SYNC_SECRET = defineSecret('SYNC_SECRET');

const SECRETS = [AKAHU_APP_TOKEN, AKAHU_USER_TOKEN, GOOGLE_SHEET_ID, SYNC_SECRET];

async function runSync() {
  const sheetId = GOOGLE_SHEET_ID.value();
  const appToken = AKAHU_APP_TOKEN.value();
  const userToken = AKAHU_USER_TOKEN.value();

  const lastSync = await getLastSync(sheetId);
  // Look back 3 days from last sync to catch late-arriving transactions.
  // Dedup by transaction ID ensures no duplicates.
  const start = lastSync
    ? new Date(new Date(lastSync).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [transactions, pending, accounts, existingIds, existingPending, rules] = await Promise.all([
    getTransactions(appToken, userToken, start),
    getPendingTransactions(appToken, userToken),
    getAccounts(appToken, userToken),
    getExistingIds(sheetId),
    getExistingPendingRows(sheetId),
    getRules(sheetId),
  ]);

  // Build a lookup of pending rows by "amount|account" to carry over category/notes
  // when a transaction settles with a new ID. If multiple pending rows share the same
  // amount+account we use the first match and remove it so it can't match twice.
  const pendingByKey = new Map<string, { category: string; notes: string }>();
  for (const p of existingPending) {
    const key = `${p.amount}|${p.account}`;
    if (!pendingByKey.has(key)) {
      pendingByKey.set(key, { category: p.category, notes: p.notes });
    }
  }

  const newTransactions = transactions.filter((t) => !existingIds.has(t._id));

  const txRows = newTransactions.map((t) => {
    const key = `${t.amount}|${t._account}`;
    const matched = pendingByKey.get(key);
    if (matched) pendingByKey.delete(key); // consume the match
    return [
      t._id,
      t.date.slice(0, 10),
      t.description,
      String(t.amount),
      t._account,
      matched?.category || applyRules(t.description, rules),
      matched?.notes ?? '',
    ];
  });

  await appendTransactions(sheetId, txRows);

  // Replace pending rows each sync, preserving any user-assigned categories/notes
  const pendingRows = pending.map((t) => [
    `pending_${t._id}`,
    new Date().toISOString().slice(0, 10),
    `[PENDING] ${t.description}`,
    String(t.amount),
    t._account,
    applyRules(t.description, rules),
    '',
  ]);
  await replacePendingTransactions(sheetId, pendingRows);

  const balanceRows = accounts.map((a) => [
    a.name,
    a._id,
    String(a.balance.current),
    a.meta?.last_transaction?.slice(0, 10) ?? '',
  ]);

  await updateBalances(sheetId, balanceRows);

  await setLastSync(sheetId, new Date().toISOString().slice(0, 10));

  console.log(`Synced ${newTransactions.length} new transactions from ${transactions.length} fetched.`);
  return { synced: newTransactions.length, fetched: transactions.length };
}

export const syncAkahu = onSchedule(
  {
    schedule: 'every 4 hours',
    timeZone: 'Pacific/Auckland',
    secrets: SECRETS,
  },
  async () => { await runSync(); },
);

export const syncAkahuHttp = onRequest(
  { secrets: SECRETS },
  async (req, res) => {
    const allowedOrigins = ['http://localhost:5174', `https://${process.env.GCLOUD_PROJECT}.web.app`];
    const origin = req.headers.origin ?? '';
    if (allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Access-Control-Allow-Headers', 'x-sync-secret');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const secret = req.headers['x-sync-secret'];
    if (!secret || secret !== SYNC_SECRET.value()) {
      res.status(401).json({ error: 'Unauthorised' });
      return;
    }
    const result = await runSync();
    res.json({ ok: true, ...result });
  },
);
