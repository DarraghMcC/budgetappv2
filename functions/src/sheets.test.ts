import { describe, it, expect } from 'vitest';
import { mergePendingRows } from './sheets';

// Row shape: [id, date, description, amount, account, category, notes]
function row(id: string, amount: string, account: string, category = '', notes = ''): string[] {
  return [id, '2026-04-01', '[PENDING] test', amount, account, category, notes];
}

describe('mergePendingRows', () => {
  it('preserves user-set category when ID matches', () => {
    const existing = [row('pending_acc1_10_0', '-10', 'acc1', 'Coffee')];
    const incoming = [row('pending_acc1_10_0', '-10', 'acc1', 'Auto')];
    const result = mergePendingRows(incoming, existing);
    expect(result[0][5]).toBe('Coffee');
  });

  it('preserves user-set notes when ID matches', () => {
    const existing = [row('pending_acc1_10_0', '-10', 'acc1', 'Coffee', 'daily')];
    const incoming = [row('pending_acc1_10_0', '-10', 'acc1', '', '')];
    const result = mergePendingRows(incoming, existing);
    expect(result[0][6]).toBe('daily');
  });

  it('falls back to amount|account match when ID changes', () => {
    const existing = [row('pending_acc1_10_0', '-10', 'acc1', 'Coffee')];
    const incoming = [row('pending_acc1_10_1', '-10', 'acc1', 'Auto')]; // different ID
    const result = mergePendingRows(incoming, existing);
    expect(result[0][5]).toBe('Coffee');
  });

  it('uses rule category when no existing row matches', () => {
    const existing: string[][] = [];
    const incoming = [row('pending_acc1_10_0', '-10', 'acc1', 'Groceries')];
    const result = mergePendingRows(incoming, existing);
    expect(result[0][5]).toBe('Groceries');
  });

  it('does not bleed category across different pending rows', () => {
    const existing = [
      row('pending_acc1_10_0', '-10', 'acc1', 'Coffee'),
      row('pending_acc1_20_1', '-20', 'acc1', 'Groceries'),
    ];
    const incoming = [
      row('pending_acc1_10_0', '-10', 'acc1', 'Auto'),
      row('pending_acc1_20_1', '-20', 'acc1', 'Auto'),
    ];
    const result = mergePendingRows(incoming, existing);
    expect(result[0][5]).toBe('Coffee');
    expect(result[1][5]).toBe('Groceries');
  });

  it('handles empty existing rows', () => {
    const incoming = [row('pending_acc1_10_0', '-10', 'acc1', 'Auto')];
    const result = mergePendingRows(incoming, []);
    expect(result[0][5]).toBe('Auto');
  });

  it('handles empty incoming rows', () => {
    const result = mergePendingRows([], [row('pending_acc1_10_0', '-10', 'acc1', 'Coffee')]);
    expect(result).toHaveLength(0);
  });
});
