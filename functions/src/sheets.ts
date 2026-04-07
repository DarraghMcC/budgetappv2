import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

export async function getExistingIds(sheetId: string): Promise<Set<string>> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'transactions!A2:A',
  });
  const rows = res.data.values ?? [];
  return new Set(rows.map((r) => r[0] as string));
}

export async function getLastSync(sheetId: string): Promise<string | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'meta!B1',
  });
  return (res.data.values?.[0]?.[0] as string) ?? null;
}

export async function setLastSync(sheetId: string, date: string): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'meta!B1',
    valueInputOption: 'RAW',
    requestBody: { values: [[date]] },
  });
}

export async function getRules(
  sheetId: string,
): Promise<Array<{ pattern: string; category: string }>> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'rules!A2:B',
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => ({ pattern: (r[0] as string) ?? '', category: (r[1] as string) ?? '' }));
}

export async function appendTransactions(sheetId: string, rows: string[][]): Promise<void> {
  if (rows.length === 0) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'transactions!A:G',
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

export interface PendingRow {
  id: string;
  amount: string;
  account: string;
  category: string;
  notes: string;
}

export async function getExistingPendingRows(sheetId: string): Promise<PendingRow[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'transactions!A2:G',
  });
  const rows = res.data.values ?? [];
  return rows
    .filter((r) => String(r[0]).startsWith('pending_'))
    .map((r) => ({
      id: r[0] as string,
      amount: r[3] as string,
      account: r[4] as string,
      category: (r[5] as string) ?? '',
      notes: (r[6] as string) ?? '',
    }));
}

// Exported for testing. Merges incoming pending rows with existing ones,
// preserving user-set category/notes. Matches by ID first, then amount|account.
export function mergePendingRows(
  incoming: string[][],
  existing: string[][],
): string[][] {
  const byId = new Map(
    existing.map((r) => [r[0] as string, { category: (r[5] as string) ?? '', notes: (r[6] as string) ?? '' }]),
  );
  const byKey = new Map(
    existing.map((r) => [`${r[3]}|${r[4]}`, { category: (r[5] as string) ?? '', notes: (r[6] as string) ?? '' }]),
  );
  return incoming.map((r) => {
    const saved = byId.get(r[0]) ?? byKey.get(`${r[3]}|${r[4]}`);
    return [r[0], r[1], r[2], r[3], r[4], saved?.category ?? r[5], saved?.notes ?? r[6]];
  });
}

export async function replacePendingTransactions(
  sheetId: string,
  rows: string[][],
): Promise<void> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'transactions!A2:G',
  });
  const existing = res.data.values ?? [];
  const nonPending = existing.filter((r) => !String(r[0]).startsWith('pending_'));
  const existingPending = existing.filter((r) => String(r[0]).startsWith('pending_'));
  const mergedPending = mergePendingRows(rows, existingPending);
  // Keep non-pending rows first so their rowIndex values stay stable for the PWA.
  // Pending rows go at the bottom.
  const updated = [...nonPending, ...mergedPending];

  // Clear the full old range first to avoid stale rows if the new content is shorter.
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: 'transactions!A2:G',
  });

  if (updated.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'transactions!A2',
      valueInputOption: 'RAW',
      requestBody: { values: updated },
    });
  }
}

export async function updateSnapshotActuals(
  sheetId: string,
  totalBalance: number,
): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'snapshots!A2:D',
  });
  const rows = res.data.values ?? [];

  const rowIndex = rows.findIndex((r) => (r[0] as string) === currentMonth);
  if (rowIndex === -1) return; // no row for this month — nothing to write

  const expected = parseFloat(rows[rowIndex][1] as string) || 0;
  const diff = totalBalance - expected;
  const sheetRow = rowIndex + 2; // 1-based + header

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `snapshots!C${sheetRow}:D${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[String(totalBalance), String(diff)]] },
  });
}

export async function updateBalances(sheetId: string, rows: string[][]): Promise<void> {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: 'balances!A2:D',
  });
  if (rows.length === 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'balances!A2',
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}
