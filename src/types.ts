export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  category: string;
  notes: string;
  rowIndex?: number;
}

export interface Category {
  name: string;
  colour: string;
  budget?: number;
}

export interface Balance {
  account: string;
  description: string;
  balance: number;
  last_transaction: string;
}

export interface BalanceCheckpoint {
  account: string; // matches balances.account (human-readable name)
  date: string;    // YYYY-MM-DD — balance is as of end of this date
  balance: number;
}

export interface Snapshot {
  month: string;    // YYYY-MM
  expected: number;
  actual: number | null;
  diff: number | null;
  rowIndex: number; // 1-based sheet row, for sync writes
}
