import type { Balance, BalanceCheckpoint, Transaction } from '../types';

export function applyCheckpoints(
  balances: Balance[],
  checkpoints: BalanceCheckpoint[],
  transactions: Transaction[],
): Balance[] {
  if (checkpoints.length === 0) return balances;
  return balances.map((b) => {
    const cp = checkpoints.find(
      (c) => c.account.toLowerCase() === b.account.toLowerCase(),
    );
    if (!cp) return b;
    // Sum all settled transactions for this account after the checkpoint date.
    // Transactions on cp.date are already included in cp.balance.
    const delta = transactions
      .filter((tx) => tx.account === b.description && tx.date > cp.date)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { ...b, balance: cp.balance + delta };
  });
}
