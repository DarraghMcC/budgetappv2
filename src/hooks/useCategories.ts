import { useCallback, useState } from 'react';
import { getCategories } from '../lib/sheets';
import { getToken } from '../lib/auth';
import type { Category } from '../types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      setCategories(await getCategories(token));
    } catch (e) {
      console.error('[useCategories] Failed to load categories:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { categories, loading, load };
}
