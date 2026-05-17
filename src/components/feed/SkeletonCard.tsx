export function SkeletonCard() {
  return (
    <div className="oz-card" aria-hidden>
      <div className="oz-card__top">
        <div className="oz-card__who">
          <div className="oz-skeleton" style={{ width: 28, height: 28, borderRadius: 14 }} />
          <div className="oz-skeleton" style={{ width: 120, height: 14 }} />
        </div>
        <div className="oz-skeleton" style={{ width: 48, height: 20, borderRadius: 9999 }} />
      </div>
      <div>
        <div className="oz-skeleton" style={{ width: 180, height: 24, marginBottom: 8 }} />
        <div className="oz-skeleton" style={{ width: 120, height: 12, marginBottom: 4 }} />
        <div className="oz-skeleton" style={{ width: 100, height: 12 }} />
      </div>
      <div className="oz-card__bottom">
        <div className="oz-skeleton" style={{ width: 80, height: 12 }} />
        <div className="oz-skeleton" style={{ width: 90, height: 30, borderRadius: 8 }} />
      </div>
    </div>
  );
}
