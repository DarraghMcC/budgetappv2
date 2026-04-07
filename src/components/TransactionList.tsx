import type { Balance, Category, Transaction } from '../types';
import { TransactionRow } from './TransactionRow';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  balances: Balance[];
  onTap: (tx: Transaction) => void;
}

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const group = map.get(tx.date) ?? [];
    group.push(tx);
    map.set(tx.date, group);
  }
  return Array.from(map.entries());
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function TransactionList({ transactions, categories, balances, onTap }: Props) {
  const accountNameById = new Map(balances.map((b) => [b.description, b.account]));
  const groups = groupByDate(transactions);

  if (groups.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">No transactions yet.</p>
    );
  }

  return (
    <div className="divide-y divide-slate-700/50">
      {groups.map(([date, txs]) => (
        <div key={date}>
          <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {formatDate(date)}
          </div>
          <div className="divide-y divide-slate-700/30">
            {txs.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                categories={categories}
                accountName={accountNameById.get(tx.account) ?? tx.account}
                onTap={onTap}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
