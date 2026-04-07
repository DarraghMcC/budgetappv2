import type { Category, Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

export function BudgetProgress({ transactions, categories }: Props) {
  const now = new Date();
  const monthTxs = transactions.filter((tx) => {
    const d = new Date(tx.date);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      tx.amount < 0
    );
  });

  const budgeted = categories.filter((c) => c.budget != null);

  if (budgeted.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Add budgets to the categories sheet to see progress here.
      </p>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {budgeted.map((cat) => {
        const spent = monthTxs
          .filter((tx) => tx.category === cat.name)
          .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        const pct = Math.min((spent / cat.budget!) * 100, 100);
        const over = spent > cat.budget!;

        return (
          <div key={cat.name}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">{cat.name}</span>
              <span className={over ? 'text-red-400' : 'text-slate-400'}>
                ${spent.toFixed(0)} / ${cat.budget!.toFixed(0)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: over ? '#f87171' : cat.colour,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
