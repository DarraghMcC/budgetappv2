import type { Balance, Snapshot } from '../types';

interface Props {
  snapshots: Snapshot[];
  balances: Balance[];
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-NZ', {
    month: 'long',
    year: 'numeric',
  });
}

function fmt(n: number): string {
  return n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SnapshotTab({ snapshots, balances }: Props) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const liveTotal = balances.reduce((sum, b) => sum + b.balance, 0);

  const sorted = [...snapshots].sort((a, b) => b.month.localeCompare(a.month));

  if (sorted.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        Add rows to the snapshots sheet to see monthly targets here.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-4 py-4">
      {sorted.map((s) => {
        const isCurrent = s.month === currentMonth;
        const actual = isCurrent ? liveTotal : s.actual;
        const diff = actual !== null ? actual - s.expected : s.diff;

        return (
          <div key={s.month} className="rounded-2xl bg-slate-800 px-4 py-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold">
                {formatMonth(s.month)}
                {isCurrent && (
                  <span className="ml-2 text-xs font-normal text-slate-400">live</span>
                )}
              </h2>
              {diff !== null && (
                <span className={`text-lg font-bold tabular-nums ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diff >= 0 ? '+' : ''}${fmt(diff)}
                </span>
              )}
            </div>

            <div className="flex justify-between text-xs text-slate-400 tabular-nums">
              <span>Expected <span className="text-white">${fmt(s.expected)}</span></span>
              <span>
                Actual{' '}
                <span className="text-white">
                  {actual !== null ? `$${fmt(actual)}` : '—'}
                </span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
