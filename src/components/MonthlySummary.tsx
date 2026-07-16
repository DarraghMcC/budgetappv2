import type { Balance, Category, Transaction } from '../types';
import { filterBudgetTransactions } from '../lib/spending';
import { PersonalDue } from './PersonalDue';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  balances: Balance[];
  clearedDates: Map<string, string>;
  onClear: (category: string) => void;
}

export function MonthlySummary({ transactions, categories, balances, clearedDates, onClear }: Props) {
  const now = new Date();
  const monthTxs = filterBudgetTransactions(transactions, balances, {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const totalSpent = monthTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalBudget = categories.reduce((sum, c) => sum + (c.budget ?? 0), 0);
  const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);

  // Spend per account this month
  const spendByAccount = new Map<string, number>();
  for (const tx of monthTxs) {
    spendByAccount.set(tx.account, (spendByAccount.get(tx.account) ?? 0) + Math.abs(tx.amount));
  }

  // Spend by category this month
  const byCategory = new Map<string, number>();
  for (const tx of monthTxs) {
    const key = tx.category || 'Uncategorised';
    byCategory.set(key, (byCategory.get(key) ?? 0) + Math.abs(tx.amount));
  }
  const categoryRows = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="px-4 py-4 space-y-6">

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-800 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">
            {now.toLocaleString('en-NZ', { month: 'long' })} spending
          </p>
          <p className="text-2xl font-bold">${totalSpent.toFixed(0)}</p>
          {totalBudget > 0 && (
            <p className={`text-xs mt-1 ${totalSpent > totalBudget ? 'text-red-400' : 'text-slate-400'}`}>
              of ${totalBudget.toFixed(0)}
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-slate-800 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Total balance</p>
          <p className={`text-2xl font-bold ${totalBalance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            ${totalBalance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Per-account */}
      {balances.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Accounts
          </h2>
          <div className="divide-y divide-slate-700/50 rounded-2xl bg-slate-800 overflow-hidden">
            {balances.map((b) => {
              const spent = spendByAccount.get(b.description) ?? 0;
              return (
                <div key={b.account} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.account}</p>
                    {spent > 0 && (
                      <p className="text-xs text-slate-400">spent ${spent.toFixed(2)} this month</p>
                    )}
                  </div>
                  <span className={`ml-4 shrink-0 text-sm font-semibold tabular-nums ${b.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    ${b.balance.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By category */}
      {categoryRows.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            By category
          </h2>
          <div className="space-y-2">
            {categoryRows.map(([name, amount]) => {
              const cat = categories.find((c) => c.name === name);
              const pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
              return (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: cat?.colour ?? '#475569' }}
                      />
                      {name}
                    </span>
                    <span className="tabular-nums text-slate-300">${amount.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: cat?.colour ?? '#475569' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Personal due */}
      <PersonalDue transactions={transactions} clearedDates={clearedDates} onClear={onClear} />

    </div>
  );
}
