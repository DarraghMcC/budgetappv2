import { useCallback, useState } from 'react';
import { getTransactions, updateCategory } from '../lib/sheets';
import { getToken } from '../lib/auth';
import type { Transaction } from '../types';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getTransactions(token);
      setTransactions(data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      console.error('[useTransactions] Failed to load transactions:', e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const categorise = useCallback(
    async (tx: Transaction, category: string, notes?: string) => {
      const token = getToken();
      if (!token || tx.rowIndex == null) return;
      try {
        await updateCategory(token, tx.rowIndex, category, notes ?? tx.notes);
      } catch (e) {
        console.error('[useTransactions] Failed to update category:', e);
        throw e;
      }
      setTransactions((prev) =>
        prev.map((t) =>
          t.rowIndex === tx.rowIndex ? { ...t, category, notes: notes ?? t.notes } : t,
        ),
      );
    },
    [],
  );

  return { transactions, loading, error, load, categorise };
}
