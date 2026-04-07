import type { Balance, Category, Transaction } from '../types';

const SHEET_ID = import.meta.env.VITE_SHEET_ID as string;
const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function getTransactions(token: string): Promise<Transaction[]> {
  const data = await request<{ values?: string[][] }>('/values/transactions!A2:G', token);
  const rows = data.values ?? [];
  return rows.map((r, i) => ({
    id: r[0] ?? '',
    date: r[1] ?? '',
    description: r[2] ?? '',
    amount: parseFloat(r[3]) || 0,
    account: r[4] ?? '',
    category: r[5] ?? '',
    notes: r[6] ?? '',
    rowIndex: i + 2, // 1-based row; +1 for header row
  }));
}

export async function updateCategory(
  token: string,
  rowIndex: number,
  category: string,
  notes = '',
): Promise<void> {
  const range = encodeURIComponent(`transactions!F${rowIndex}:G${rowIndex}`);
  await request(`/values/${range}?valueInputOption=RAW`, token, {
    method: 'PUT',
    body: JSON.stringify({ values: [[category, notes]] }),
  });
}

export async function getBalances(token: string): Promise<Balance[]> {
  const data = await request<{ values?: string[][] }>('/values/balances!A2:D', token);
  const rows = data.values ?? [];
  return rows.map((r) => ({
    account: r[0] ?? '',
    description: r[1] ?? '',
    balance: parseFloat(r[2]) || 0,
    last_transaction: r[3] ?? '',
  }));
}

export async function getCategories(token: string): Promise<Category[]> {
  const data = await request<{ values?: string[][] }>('/values/categories!A2:C', token);
  const rows = data.values ?? [];
  return rows.map((r) => ({
    name: r[0] ?? '',
    colour: r[1] ?? '#64748b',
    budget: r[2] ? parseFloat(r[2]) : undefined,
  }));
}
