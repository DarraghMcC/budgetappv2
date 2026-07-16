import type { Transaction } from '../types';
import { PERSONAL_CATEGORIES } from '../lib/spending';

interface Props {
  transactions: Transaction[];
  clearedDates: Map<string, string>;
  onClear: (category: string) => void;
}

export function PersonalDue({ transactions, clearedDates, onClear }: Props) {
  const debts = PERSONAL_CATEGORIES.map((cat) => {
    const clearedDate = clearedDates.get(cat) ?? '';
    const amount = transactions
      .filter(
        (tx) =>
          tx.amount < 0 &&
          !tx.id.startsWith('pending_') &&
          tx.category.toLowerCase() === cat.toLowerCase() &&
          tx.date > clearedDate,
      )
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return { cat, amount };
  });

  return (
    <div>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Personal due
      </h2>
      <div className="divide-y divide-slate-700/50 rounded-2xl bg-slate-800 overflow-hidden">
        {debts.map(({ cat, amount }) => (
          <div key={cat} className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-medium">{cat}</p>
            <div className="ml-4 flex items-center gap-3 shrink-0">
              <span className={`text-sm font-semibold tabular-nums ${amount > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                ${amount.toFixed(2)}
              </span>
              {amount > 0 && (
                <button
                  onClick={() => onClear(cat)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 active:bg-slate-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
