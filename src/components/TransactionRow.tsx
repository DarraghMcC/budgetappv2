import type { Category, Transaction } from '../types';

interface Props {
  transaction: Transaction;
  categories: Category[];
  accountName: string;
  onTap: (tx: Transaction) => void;
}

export function TransactionRow({ transaction: tx, categories, accountName, onTap }: Props) {
  const cat = categories.find((c) => c.name === tx.category);
  const isDebit = tx.amount < 0;

  return (
    <button
      onClick={() => onTap(tx)}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-700/50 ${!tx.category && tx.amount < 0 ? 'bg-red-950/40' : ''}`}
    >
      {/* Category dot */}
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: cat?.colour ?? '#475569' }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tx.description}</p>
        <p className="text-xs text-slate-400">
          {[tx.category, accountName].filter(Boolean).join(' · ')}
        </p>
      </div>

      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          isDebit ? 'text-white' : 'text-emerald-400'
        }`}
      >
        {isDebit ? '' : '+'}
        {tx.amount.toFixed(2)}
      </span>
    </button>
  );
}
