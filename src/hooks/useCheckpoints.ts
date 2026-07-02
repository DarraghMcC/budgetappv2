import { useCallback, useState } from 'react';
import { getCheckpoints } from '../lib/sheets';
import { getToken } from '../lib/auth';
import type { BalanceCheckpoint } from '../types';

export function useCheckpoints() {
  const [checkpoints, setCheckpoints] = useState<BalanceCheckpoint[]>([]);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setCheckpoints(await getCheckpoints(token));
    } catch {
      // checkpoints sheet doesn't exist — fine, no adjustments applied
    }
  }, []);

  return { checkpoints, load };
}
