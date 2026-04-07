import { describe, it, expect } from 'vitest';
import { filterBudgetTransactions } from './spending';
import type { Balance, Transaction } from '../types';

function tx(overrides: Partial<Transaction> & { date: string; amount: number; account: string }): Transaction {
  return { id: 'id', description: 'test', category: '', notes: '', ...overrides };
}

const balances: Balance[] = [
  { account: 'ANZ Everyday', description: 'acc_shared', balance: 1000, last_transaction: '' },
  { account: 'Darragh Personal', description: 'acc_personal', balance: 500, last_transaction: '' },
];

const month = { year: 2026, month: 4 };

describe('filterBudgetTransactions', () => {
  it('includes debits from non-personal accounts in the target month', () => {
    const result = filterBudgetTransactions(
      [tx({ date: '2026-04-05', amount: -50, account: 'acc_shared' })],
      balances,
      month,
    );
    expect(result).toHaveLength(1);
  });

  it('excludes transactions from Darragh Personal account', () => {
    const result = filterBudgetTransactions(
      [tx({ date: '2026-04-05', amount: -50, account: 'acc_personal' })],
      balances,
      month,
    );
    expect(result).toHaveLength(0);
  });

  it('excludes credits (positive amounts)', () => {
    const result = filterBudgetTransactions(
      [tx({ date: '2026-04-05', amount: 100, account: 'acc_shared' })],
      balances,
      month,
    );
    expect(result).toHaveLength(0);
  });

  it('excludes transactions from other months', () => {
    const result = filterBudgetTransactions(
      [tx({ date: '2026-03-31', amount: -50, account: 'acc_shared' })],
      balances,
      month,
    );
    expect(result).toHaveLength(0);
  });

  it('excludes transactions from other years', () => {
    const result = filterBudgetTransactions(
      [tx({ date: '2025-04-05', amount: -50, account: 'acc_shared' })],
      balances,
      month,
    );
    expect(result).toHaveLength(0);
  });

  it('works when no balances are provided (no personal account to exclude)', () => {
    const result = filterBudgetTransactions(
      [tx({ date: '2026-04-05', amount: -50, account: 'acc_personal' })],
      [],
      month,
    );
    expect(result).toHaveLength(1);
  });
});
