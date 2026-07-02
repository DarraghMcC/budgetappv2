const AKAHU_BASE = 'https://api.akahu.io/v1';

export interface AkahuTransaction {
  _id: string;
  date: string;
  description: string;
  amount: number;
  _account: string;
  type: string;
  merchant?: { name: string };
}

export interface AkahuAccount {
  _id: string;
  name: string;
  type?: string;
  balance: { current: number; available?: number; limit?: number; overdrawn?: boolean };
  meta?: { last_transaction?: string; [key: string]: unknown };
  [key: string]: unknown;
}

async function akahuFetch(path: string, appToken: string, userToken: string) {
  const res = await fetch(`${AKAHU_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${userToken}`,
      'X-Akahu-Id': appToken,
    },
  });
  if (!res.ok) throw new Error(`Akahu API error: ${res.status} ${path}`);
  return res.json() as Promise<{ items: unknown[]; cursor?: { next?: string } }>;
}

export async function getTransactions(
  appToken: string,
  userToken: string,
  start: string,
): Promise<AkahuTransaction[]> {
  const all: AkahuTransaction[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ start });
    if (cursor) params.set('cursor', cursor);
    const data = await akahuFetch(`/transactions?${params}`, appToken, userToken);
    all.push(...((data.items ?? []) as AkahuTransaction[]));
    cursor = data.cursor?.next;
  } while (cursor);

  return all;
}

export async function getPendingTransactions(
  appToken: string,
  userToken: string,
): Promise<AkahuTransaction[]> {
  const data = await akahuFetch('/transactions/pending', appToken, userToken);
  return (data.items ?? []) as AkahuTransaction[];
}

export async function getAccounts(
  appToken: string,
  userToken: string,
): Promise<AkahuAccount[]> {
  const data = await akahuFetch('/accounts', appToken, userToken);
  return (data.items ?? []) as AkahuAccount[];
}
