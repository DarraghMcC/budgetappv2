import type { Balance, Category, Transaction } from '../types';
import { PERSONAL_ACCOUNT } from '../lib/spending';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  balances: Balance[];
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

export function HistoryTab({ transactions, categories, balances }: Props) {
  const personalId = balances.find((b) => b.account === PERSONAL_ACCOUNT)?.description;
  const colourByName = new Map(categories.map((c) => [c.name, c.colour]));

  const filtered = transactions.filter(
    (tx) => tx.amount < 0 && !tx.id.startsWith('pending_') && tx.account !== personalId,
  );

  const byMonth = new Map<string, Transaction[]>();
  for (const tx of filtered) {
    const month = tx.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(tx);
  }
  const months = [...byMonth.keys()].sort().reverse();

  if (months.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No transaction history yet.</p>;
  }

  return (
    <div className="divide-y divide-slate-800">
      {months.map((month) => {
        const byCat = new Map<string, number>();
        for (const tx of byMonth.get(month)!) {
          const key = tx.category || 'Uncategorised';
          byCat.set(key, (byCat.get(key) ?? 0) + Math.abs(tx.amount));
        }
        const cats = [...byCat.entries()].sort(([, a], [, b]) => b - a);
        const total = cats.reduce((sum, [, amt]) => sum + amt, 0);

        return (
          <div key={month} className="px-4 py-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{monthLabel(month)}</h2>
              <span className="text-sm text-slate-400">${total.toFixed(0)}</span>
            </div>
            <div className="space-y-2">
              {cats.map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: colourByName.get(cat) ?? '#64748b' }}
                    />
                    <span className="text-slate-300">{cat}</span>
                  </div>
                  <span className="text-slate-400">${amt.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
