import { useCallback, useState } from 'react';
import { getBalances } from '../lib/sheets';
import { getToken } from '../lib/auth';
import type { Balance } from '../types';

export function useBalances() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      setBalances(await getBalances(token));
    } catch (e) {
      console.error('[useBalances] Failed to load balances:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { balances, loading, load };
}
