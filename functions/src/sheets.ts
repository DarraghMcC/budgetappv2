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
