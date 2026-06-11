/* global React, useState, useContext, useRouter, BrandMark, Avatar, RateWidget, ListingCard, DEMO_LISTINGS, CURRENT_USER */

function Header() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px 8px",
      background: "var(--bg)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BrandMark size={32} />
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>öz</span>
      </div>
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
          aria-label="Меню профиля"
        >
          <Avatar name={CURRENT_USER.displayName} phone={CURRENT_USER.phone} />
        </button>
        {menuOpen && (
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)",
            minWidth: 160,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-pop)",
            padding: 6,
            display: "flex", flexDirection: "column",
            zIndex: 20,
          }}>
            {[
              { label: "Профиль", path: "/profile" },
              { label: "Оповещения", path: "/alerts" },
            ].map((item) => (
              <button
                key={item.path}
                style={{ border: 0, background: "transparent", textAlign: "left", fontSize: 14, color: "var(--text)", padding: "10px 12px", borderRadius: "var(--r-sm)", cursor: "pointer" }}
                onClick={() => { setMenuOpen(false); router.push(item.path); }}
              >{item.label}</button>
            ))}
            <button
              style={{ border: 0, background: "transparent", textAlign: "left", fontSize: 14, color: "var(--text)", padding: "10px 12px", borderRadius: "var(--r-sm)", cursor: "pointer" }}
              onClick={() => { setMenuOpen(false); router.replace("/"); }}
            >Выйти</button>
          </div>
        )}
      </div>
    </header>
  );
}

function FilterBar({ filter, setFilter, sort, setSort }) {
  return (
    <div className="oz-filterbar">
      <div className="oz-segmented" role="tablist">
        {[
          { v: "all", label: "Все" },
          { v: "kzt_to_krw", label: "₸ → ₩" },
          { v: "krw_to_kzt", label: "₩ → ₸" },
        ].map(({ v, label }) => (
          <button
            key={v}
            role="tab"
            aria-selected={filter === v}
            className={"oz-segmented__btn" + (filter === v ? " oz-segmented__btn--active" : "")}
            onClick={() => setFilter(v)}
          >{label}</button>
        ))}
      </div>
      <select className="oz-sortselect" value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="new">Сначала новые</option>
        <option value="rate">По курсу</option>
        <option value="active">Активные</option>
      </select>
    </div>
  );
}

function PostListingSheet({ open, onClose, onSubmit }) {
  const [direction, setDirection] = useState("kzt_to_krw");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;
  const canSubmit = !!amount && !submitting;

  function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => {
      onSubmit({ direction, amount: Number(amount.replace(/\s/g, "")), rate: rate ? Number(rate.replace(",", ".")) : null, note: note || null });
      setSubmitting(false);
      setAmount(""); setRate(""); setNote("");
    }, 350);
  }

  return (
    <>
      <div className="oz-sheet-scrim" onClick={onClose} aria-hidden></div>
      <div className="oz-sheet" role="dialog" aria-modal="true">
        <div className="oz-sheet__handle"></div>
        <h2 className="oz-sheet__title">Новое объявление</h2>
        <form onSubmit={submit}>
          <div className="oz-sheet__field">
            <label className="oz-sheet__label">Направление</label>
            <div className="oz-segmented" role="tablist">
              <button type="button" className={"oz-segmented__btn" + (direction === "kzt_to_krw" ? " oz-segmented__btn--active" : "")} onClick={() => setDirection("kzt_to_krw")}>₸ → ₩</button>
              <button type="button" className={"oz-segmented__btn" + (direction === "krw_to_kzt" ? " oz-segmented__btn--active" : "")} onClick={() => setDirection("krw_to_kzt")}>₩ → ₸</button>
            </div>
          </div>
          <div className="oz-sheet__field">
            <label className="oz-sheet__label" htmlFor="amt">Сумма</label>
            <div className="oz-input--withsuffix">
              <input
                id="amt"
                className="oz-input"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  const d = e.target.value.replace(/[^\d]/g, "");
                  setAmount(d ? Number(d).toLocaleString("ru-RU").replace(/,/g, "\u202F") : "");
                }}
                style={{ fontFamily: "var(--font-mono)" }}
              />
              <span className="oz-input__suffix">{direction === "kzt_to_krw" ? "₸" : "₩"}</span>
            </div>
          </div>
          <div className="oz-sheet__field">
            <label className="oz-sheet__label" htmlFor="rate">Курс</label>
            <div className="oz-input--withsuffix">
              <input
                id="rate"
                className="oz-input"
                inputMode="decimal"
                placeholder="3,19"
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ""))}
                style={{ fontFamily: "var(--font-mono)" }}
              />
              <span className="oz-input__suffix">₩/₸</span>
            </div>
            <div className="oz-sheet__helper">Оставьте пустым для рыночного курса</div>
          </div>
          <div className="oz-sheet__field">
            <label className="oz-sheet__label" htmlFor="note">Примечание</label>
            <textarea
              id="note"
              className="oz-textarea"
              maxLength={280}
              placeholder="Например: только Kaspi, до 22:00"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="oz-charcount">{note.length}/280</div>
          </div>
          <button type="submit" disabled={!canSubmit} className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg">
            {submitting ? "Публикация…" : "Опубликовать"}
          </button>
        </form>
      </div>
    </>
  );
}

function FeedScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("new");
  const [items, setItems] = useState(DEMO_LISTINGS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pulseId, setPulseId] = useState(null);

  const filtered = items.filter((l) => filter === "all" || l.direction === filter);

  function onPost(payload) {
    const newRow = {
      id: "l-new-" + Date.now(),
      userId: CURRENT_USER.id,
      direction: payload.direction,
      amount: payload.amount,
      rate: payload.rate,
      note: payload.note,
      createdAt: "только что",
      profile: {
        displayName: CURRENT_USER.displayName,
        phone: CURRENT_USER.phone,
        ratingAvg: CURRENT_USER.ratingAvg,
        ratingCount: CURRENT_USER.ratingCount,
        verificationTier: CURRENT_USER.verificationTier,
        avatarUrl: null,
      },
    };
    setItems((prev) => [newRow, ...prev]);
    setSheetOpen(false);
    setPulseId(newRow.id);
    setTimeout(() => setPulseId(null), 1200);
  }

  return (
    <div className="oz-page" style={{ position: "relative" }}>
      <Header />
      <FilterBar filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} />

      <div style={{ padding: "16px 16px 0", display: "flex", justifyContent: "center" }}>
        <RateWidget />
      </div>

      <section style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((l) => (
          <div key={l.id} style={pulseId === l.id ? { animation: "ozPulseOnce 1.2s ease-out" } : null}>
            <ListingCard
              listing={l}
              isOwn={l.userId === CURRENT_USER.id}
              onContact={(id) => router.push(`/listing/${id}`)}
              onEdit={(id) => router.push(`/listing/${id}`)}
              onWithdraw={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
            />
          </div>
        ))}
      </section>

      <footer className="oz-feed-disclaimer">
        öz — сообщество для прямого обмена. Платформа не участвует в передаче средств.
        <br />
        <a href="#" style={{ color: "inherit" }} onClick={(e) => e.preventDefault()}>условия</a>
        {" / "}
        <a href="#" style={{ color: "inherit" }} onClick={(e) => e.preventDefault()}>конфиденциальность</a>
      </footer>

      <button
        className="oz-fab"
        onClick={() => setSheetOpen(true)}
        aria-label="Новое объявление"
        style={{ position: "absolute" }}
      >＋</button>

      <PostListingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={onPost}
      />
    </div>
  );
}

window.FeedScreen = FeedScreen;
