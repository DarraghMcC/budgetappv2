import { useEffect, useState } from 'react';
import { clearToken, initAuth, requestToken } from './lib/auth';
import { useTransactions } from './hooks/useTransactions';
import { useCategories } from './hooks/useCategories';
import { useBalances } from './hooks/useBalances';
import { useSnapshots } from './hooks/useSnapshots';
import { TransactionList } from './components/TransactionList';
import { CategoryPicker } from './components/CategoryPicker';
import { MonthlySummary } from './components/MonthlySummary';
import { BudgetProgress } from './components/BudgetProgress';
import { SnapshotTab } from './components/SnapshotTab';
import type { Transaction } from './types';

type View = 'transactions' | 'summary' | 'budget' | 'snapshot';

export function App() {
  const [authed, setAuthed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [view, setView] = useState<View>('transactions');
  const [picking, setPicking] = useState<Transaction | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const { transactions, loading, error, load, categorise } = useTransactions();
  const { categories, load: loadCategories } = useCategories();
  const { balances, load: loadBalances } = useBalances();
  const { snapshots, load: loadSnapshots } = useSnapshots();

  // Initialise GIS once the script has loaded — poll until available
  useEffect(() => {
    let cancelled = false;
    function tryInit() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.accounts?.oauth2) {
        initAuth();
      } else if (!cancelled) {
        setTimeout(tryInit, 100);
      }
    }
    tryInit();
    return () => { cancelled = true; };
  }, []);

  async function signIn() {
    setSigning(true);
    setAuthError(null);
    try {
      await requestToken();
      setAuthed(true);
      await Promise.all([load(), loadCategories(), loadBalances(), loadSnapshots()]);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setSigning(false);
    }
  }

  function signOut() {
    clearToken();
    setAuthed(false);
  }

  async function triggerSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(import.meta.env.VITE_SYNC_URL as string, {
        method: 'POST',
        headers: { 'x-sync-secret': import.meta.env.VITE_SYNC_SECRET as string },
      });
      const data = await res.json() as { ok?: boolean; synced?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setSyncMsg(`Synced ${data.synced ?? 0} new transactions`);
      await Promise.all([load(), loadBalances()]);
    } catch (e) {
      console.error('[triggerSync] Sync failed:', e);
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleCategorySelect(category: string) {
    if (!picking) return;
    await categorise(picking, category);
    setPicking(null);
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-900 px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Budget</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in with the Google account that owns your budget sheet.
          </p>
        </div>
        <button
          onClick={signIn}
          disabled={signing}
          className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 active:opacity-80 disabled:opacity-50"
        >
          {signing ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {authError && (
          <p className="text-center text-xs text-red-400 max-w-xs">{authError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-900">
      {/* Header */}
      <header className="pt-safe-top px-4 pb-0">
        <div className="flex items-center justify-between pb-2">
          <h1 className="text-lg font-bold">Budget</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="text-xs text-slate-400 active:opacity-60 disabled:opacity-40"
            >
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
            <button onClick={signOut} className="text-xs text-slate-400 active:opacity-60">
              Sign out
            </button>
          </div>
        </div>

        {/* Top nav tabs */}
        <nav className="flex border-b border-slate-700">
          {(
            [
              { id: 'transactions', label: 'Transactions' },
              { id: 'summary', label: 'Summary' },
              { id: 'budget', label: 'Budget' },
              { id: 'snapshot', label: 'Snapshot' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                view === tab.id
                  ? 'text-white border-white'
                  : 'text-slate-500 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {syncMsg && (
          <p className="py-1 text-center text-xs text-slate-400">{syncMsg}</p>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        {loading && (
          <p className="py-12 text-center text-sm text-slate-500">Loading…</p>
        )}
        {error && (
          <p className="px-4 py-4 text-sm text-red-400">{error}</p>
        )}

        {!loading && view === 'transactions' && (
          <TransactionList
            transactions={transactions}
            categories={categories}
            balances={balances}
            onTap={setPicking}
          />
        )}
        {!loading && view === 'summary' && (
          <MonthlySummary transactions={transactions} categories={categories} balances={balances} />
        )}
        {!loading && view === 'budget' && (
          <BudgetProgress transactions={transactions} categories={categories} balances={balances} />
        )}
        {!loading && view === 'snapshot' && (
          <SnapshotTab snapshots={snapshots} balances={balances} />
        )}
      </main>

      {/* Category picker overlay */}
      {picking && (
        <CategoryPicker
          transaction={picking}
          categories={categories}
          onSelect={handleCategorySelect}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
