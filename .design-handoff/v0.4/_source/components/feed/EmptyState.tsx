type Variant = "no-match" | "all-expired";

type SecondaryCTA = {
  label: string;
  onClick: () => void;
};

type Props = {
  variant: Variant;
  onCreate?: () => void;
  onRefresh?: () => void;
  secondary?: SecondaryCTA;
};

const COPY: Record<Variant, { title: string; cta?: string }> = {
  "no-match": {
    title: "Пока нет объявлений в этом направлении. Создайте первое.",
    cta: "Создать объявление",
  },
  "all-expired": {
    title: "Все объявления истекли. Обновите страницу или создайте новое.",
    cta: "Обновить",
  },
};

export function EmptyState({ variant, onCreate, onRefresh, secondary }: Props) {
  const { title, cta } = COPY[variant];
  const handler = variant === "no-match" ? onCreate : onRefresh;
  return (
    <div className="text-center py-16 px-6">
      <p className="text-[14px] text-text-2 mb-4">{title}</p>
      {cta && handler && (
        <button onClick={handler} className="oz-btn oz-btn--secondary">
          {cta}
        </button>
      )}
      {secondary && (
        <div className="mt-3">
          <button
            onClick={secondary.onClick}
            className="oz-btn oz-btn--ghost"
          >
            {secondary.label}
          </button>
        </div>
      )}
    </div>
  );
}
