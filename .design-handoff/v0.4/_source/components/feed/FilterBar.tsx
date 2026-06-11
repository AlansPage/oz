"use client";

export type DirectionFilter = "all" | "kzt_to_krw" | "krw_to_kzt";
export type SortOption = "new" | "rate" | "active";

const DIRECTION_LABEL: Record<DirectionFilter, string> = {
  all: "Все",
  kzt_to_krw: "₸ → ₩",
  krw_to_kzt: "₩ → ₸",
};

const SORT_LABEL: Record<SortOption, string> = {
  new: "Новые",
  rate: "По курсу",
  active: "Активные",
};

type Props = {
  filter: DirectionFilter;
  sort: SortOption;
  onFilterChange: (f: DirectionFilter) => void;
  onSortChange: (s: SortOption) => void;
};

export function FilterBar({ filter, sort, onFilterChange, onSortChange }: Props) {
  return (
    <div className="oz-filterbar">
      <div className="oz-segmented" role="tablist" aria-label="Направление">
        {(Object.keys(DIRECTION_LABEL) as DirectionFilter[]).map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={filter === d}
            className={`oz-segmented__btn${filter === d ? " oz-segmented__btn--active" : ""}`}
            onClick={() => onFilterChange(d)}
          >
            {DIRECTION_LABEL[d]}
          </button>
        ))}
      </div>
      <select
        className="oz-sortselect"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        aria-label="Сортировка"
      >
        {(Object.keys(SORT_LABEL) as SortOption[]).map((s) => (
          <option key={s} value={s}>
            {SORT_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
