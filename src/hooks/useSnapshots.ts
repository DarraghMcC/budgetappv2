import { useCallback, useState } from 'react';
import { getSnapshots } from '../lib/sheets';
import { getToken } from '../lib/auth';
import type { Snapshot } from '../types';

export function useSnapshots() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      setSnapshots(await getSnapshots(token));
    } catch (e) {
      console.error('[useSnapshots] Failed to load snapshots:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { snapshots, loading, load };
}
