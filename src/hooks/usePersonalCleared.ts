import { useCallback, useState } from 'react';
import { getPersonalClearedDates, setPersonalClearedDate } from '../lib/sheets';
import { getToken } from '../lib/auth';

function nzToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Pacific/Auckland' }).format(new Date());
}

export function usePersonalCleared() {
  const [clearedDates, setClearedDates] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setClearedDates(await getPersonalClearedDates(token));
    } catch (e) {
      console.error('[usePersonalCleared] Failed to load:', e);
    }
  }, []);

  const clear = useCallback(async (category: string) => {
    const token = getToken();
    if (!token) return;
    const today = nzToday();
    setClearedDates((prev) => new Map([...prev, [category, today]]));
    try {
      await setPersonalClearedDate(token, category, today);
    } catch (e) {
      console.error('[usePersonalCleared] Failed to persist cleared date:', e);
    }
  }, []);

  return { clearedDates, load, clear };
}
