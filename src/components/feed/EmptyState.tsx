type Variant = "no-match" | "all-expired";

type Props = {
  variant: Variant;
  onCreate?: () => void;
  onRefresh?: () => void;
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

export function EmptyState({ variant, onCreate, onRefresh }: Props) {
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
    </div>
  );
}
