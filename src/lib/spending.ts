import type { Balance, Transaction } from '../types';

export const PERSONAL_ACCOUNT = 'Darragh Personal';

export function filterBudgetTransactions(
  transactions: Transaction[],
  balances: Balance[],
  month: { year: number; month: number }, // month is 1-based
): Transaction[] {
  const personalId = balances.find((b) => b.account === PERSONAL_ACCOUNT)?.description;
  return transactions.filter((tx) => {
    const [y, m] = tx.date.split('-').map(Number);
    return (
      y === month.year &&
      m === month.month &&
      tx.amount < 0 &&
      tx.account !== personalId
    );
  });
}
