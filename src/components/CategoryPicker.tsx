import type { Category, Transaction } from '../types';

interface Props {
  transaction: Transaction;
  categories: Category[];
  onSelect: (category: string) => void;
  onClose: () => void;
}

export function CategoryPicker({ transaction, categories, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-slate-800 p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-xs text-slate-400 truncate">{transaction.description}</div>
        <h2 className="mb-4 text-base font-semibold">Choose category</h2>

        <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => onSelect(cat.name)}
              className="flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium active:opacity-70"
              style={{ backgroundColor: cat.colour + '33', borderLeft: `3px solid ${cat.colour}` }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: cat.colour }}
              />
              {cat.name}
            </button>
          ))}

          {/* Clear category */}
          <button
            onClick={() => onSelect('')}
            className="flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-3 text-left text-sm text-slate-400 active:opacity-70"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
