import { describe, it, expect } from 'vitest';
import { applyRules } from './categorise';

const rules = [
  { pattern: 'countdown', category: 'Groceries' },
  { pattern: 'netflix', category: 'Subscriptions' },
  { pattern: 'bp ', category: 'Petrol' },
];

describe('applyRules', () => {
  it('matches case-insensitively', () => {
    expect(applyRules('COUNTDOWN PONSONBY', rules)).toBe('Groceries');
    expect(applyRules('Countdown City', rules)).toBe('Groceries');
  });

  it('returns the first matching rule', () => {
    const overlapping = [
      { pattern: 'countdown', category: 'Groceries' },
      { pattern: 'countdown', category: 'Other' },
    ];
    expect(applyRules('COUNTDOWN PONSONBY', overlapping)).toBe('Groceries');
  });

  it('returns empty string when no rule matches', () => {
    expect(applyRules('UBER EATS', rules)).toBe('');
  });

  it('returns empty string for empty description', () => {
    expect(applyRules('', rules)).toBe('');
  });

  it('returns empty string when rules list is empty', () => {
    expect(applyRules('COUNTDOWN', [])).toBe('');
  });

  it('empty pattern matches everything — callers should not add empty patterns', () => {
    // applyRules short-circuits on empty pattern via the `rule.pattern &&` guard
    // but String.includes('') is always true, so empty patterns are skipped correctly
    const withEmpty = [{ pattern: '', category: 'Catch-all' }];
    expect(applyRules('ANYTHING', withEmpty)).toBe('');
  });

  it('matches substrings — trailing space in pattern prevents some false matches', () => {
    // 'bp ' matches 'BP STATION' and also 'NZBP TRANSACTION' (nzbp transaction contains "bp ")
    expect(applyRules('BP STATION', rules)).toBe('Petrol');
    expect(applyRules('NZBP TRANSACTION', rules)).toBe('Petrol'); // known substring match
    expect(applyRules('NZBP', rules)).toBe(''); // no space after — does not match 'bp '
  });
});
