/* global React */
const { useState, useEffect, useRef, createContext, useContext } = React;

/* ── Demo data ────────────────────────────────────────────────────── */
const CURRENT_USER = {
  id: "u-self",
  displayName: "Бағдат К.",
  phone: "+77011234567",
  ratingAvg: 4.8,
  ratingCount: 7,
  verificationTier: "phone_id",
};

const DEMO_LISTINGS = [
  {
    id: "l-001",
    userId: "u-001",
    direction: "kzt_to_krw",
    amount: 750000,
    rate: 3.19,
    note: "Только Kaspi, до 22:00 КЗ.",
    createdAt: "5 мин назад",
    profile: {
      displayName: "Айгерим Қ.",
      phone: "+77011234123",
      ratingAvg: 4.8,
      ratingCount: 12,
      verificationTier: "phone_id",
      avatarUrl: null,
    },
  },
  {
    id: "l-002",
    userId: "u-002",
    direction: "krw_to_kzt",
    amount: 1200000,
    rate: 3.18,
    note: null,
    createdAt: "11 мин назад",
    profile: {
      displayName: "Daulet S.",
      phone: "+821012345678",
      ratingAvg: 4.9,
      ratingCount: 28,
      verificationTier: "verified_trader",
      avatarUrl: null,
    },
  },
  {
    id: "l-003",
    userId: "u-003",
    direction: "kzt_to_krw",
    amount: 300000,
    rate: null,
    note: "По рынку, KakaoBank.",
    createdAt: "23 мин назад",
    profile: {
      displayName: "Нурлан А.",
      phone: "+77017778899",
      ratingAvg: null,
      ratingCount: 0,
      verificationTier: "phone",
      avatarUrl: null,
    },
  },
  {
    id: "l-004",
    userId: "u-004",
    direction: "krw_to_kzt",
    amount: 850000,
    rate: 3.20,
    note: "Готов сегодня вечером.",
    createdAt: "1 ч назад",
    profile: {
      displayName: "Аяна М.",
      phone: "+77076660001",
      ratingAvg: 5.0,
      ratingCount: 4,
      verificationTier: "phone_id",
      avatarUrl: null,
    },
  },
];

const DEMO_RATE = {
  rate: 3.19,
  sparkline: [
    3.14, 3.13, 3.15, 3.16, 3.14, 3.15, 3.17, 3.17,
    3.16, 3.18, 3.19, 3.18, 3.19, 3.19, 3.20, 3.19,
  ].map((r) => ({ rate: r })),
};

const SYMBOL = { KZT: "₸", KRW: "₩" };
const directionFrom = (d) => (d === "kzt_to_krw" ? "KZT" : "KRW");
const directionTo = (d) => (d === "kzt_to_krw" ? "KRW" : "KZT");

/* Russian number formatting: thin space groups + comma decimal */
function formatAmountBare(n) {
  const fixed = Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(".", ",");
  return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
}
function formatAmount(n, currency) {
  return `${formatAmountBare(n)} ${SYMBOL[currency]}`;
}
function formatRate(n) {
  return n.toFixed(2).replace(".", ",");
}
function equivalentAmount(amount, fromCurrency, marketRate, listingRate) {
  const r = listingRate ?? marketRate;
  if (fromCurrency === "KZT") return Math.round(amount * r);
  return Math.round(amount / r);
}
function formatPhoneMasked(p) {
  if (!p) return "";
  return p.replace(/^(\+\d{1,3})(\d{3})(\d{3})(\d{2})(\d{2}).*$/, "$1 ($2) ***-**-$5");
}

/* ── Brand mark ───────────────────────────────────────────────────── */
function BrandMark({ size = 56 }) {
  const fontSize = Math.round(size * 0.64);
  const radius = Math.round(size * 0.25);
  return (
    <div
      className="oz-brand-mark"
      style={{
        width: size,
        height: size,
        fontSize,
        borderRadius: radius,
      }}
      aria-hidden
    >
      ö
    </div>
  );
}

/* ── Avatar ───────────────────────────────────────────────────────── */
function initial(name, phone) {
  const source = (name || "").trim() || (phone || "").trim();
  if (!source) return "?";
  const first = source.match(/[A-Za-zА-Яа-яЁё0-9]/);
  return (first?.[0] ?? "?").toUpperCase();
}
function Avatar({ url, name, phone, size = "sm" }) {
  const sizeCls =
    size === "xl" ? "oz-avatar--xl" :
    size === "lg" ? "oz-avatar--lg" :
    size === "xs" ? "oz-avatar--xs" : "";
  const cls = sizeCls ? `oz-avatar ${sizeCls}` : "oz-avatar";
  if (url) return <img src={url} alt="" className={cls} />;
  return <div className={cls} aria-hidden>{initial(name, phone)}</div>;
}

/* ── Verification badge ───────────────────────────────────────────── */
const VBADGE_SHORT = { phone: "тел.", phone_id: "ID", verified_trader: "трейдер" };
const VBADGE_FULL = {
  phone: "Телефон подтверждён",
  phone_id: "Удостоверение проверено",
  verified_trader: "Верифицированный трейдер",
};
const VBADGE_CLASS = {
  phone: "oz-vbadge oz-vbadge--phone",
  phone_id: "oz-vbadge oz-vbadge--id",
  verified_trader: "oz-vbadge oz-vbadge--trader",
};
function VerificationBadge({ tier, full }) {
  return (
    <span className={VBADGE_CLASS[tier]}>
      {full ? VBADGE_FULL[tier] : VBADGE_SHORT[tier]}
    </span>
  );
}

/* ── Rate widget v2 ───────────────────────────────────────────────── */
function DirectionTriangle() {
  return (
    <svg className="oz-rate__tri" width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6 4.5 L15 10 L6 15.5 Z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function RateSparkline({ values }) {
  if (values.length < 2) return null;
  const VB_W = 120, VB_H = 44, PAD = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const span = flat ? 1 : max - min;
  const innerW = VB_W - PAD * 2;
  const innerH = VB_H - PAD * 2;
  const stepX = innerW / (values.length - 1);
  const points = values.map((v, i) => {
    const x = PAD + i * stepX;
    const y = flat ? VB_H / 2 : VB_H - PAD - ((v - min) / span) * innerH;
    return [x, y];
  });
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const [dotX, dotY] = points[points.length - 1];
  return (
    <svg className="oz-rate__spark" viewBox={`0 0 ${VB_W} ${VB_H}`} role="presentation" aria-hidden>
      <defs>
        <linearGradient id="oz-rate-spark-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VB_W} y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.28" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="oz-rate-spark-mask">
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#oz-rate-spark-fade)" />
        </mask>
      </defs>
      <g mask="url(#oz-rate-spark-mask)">
        <path className="oz-rate__spark-path" d={d} pathLength={1} />
      </g>
      <circle className="oz-rate__spark-dot" cx={dotX.toFixed(2)} cy={dotY.toFixed(2)} r={4} />
    </svg>
  );
}

function RateWidget({ data = DEMO_RATE, error = false }) {
  const hasData = !!data && !error;
  const values = hasData ? data.sparkline.map((p) => p.rate) : [];
  return (
    <div className="oz-rate" aria-label={hasData ? `1 тенге = ${formatRate(data.rate)} вон` : "Курс недоступен"}>
      <div className="oz-rate__row">
        <span className="oz-rate__icons">
          <span className="oz-rate__sym">₸</span>
          <DirectionTriangle />
          <span className="oz-rate__sym">₩</span>
        </span>
        {error ? (
          <span className="oz-rate__num oz-rate__num--err">—</span>
        ) : hasData ? (
          <span className="oz-rate__num"><span className="oz-rate__num-inner">{formatRate(data.rate)}</span></span>
        ) : null}
        {hasData && values.length >= 2 && <RateSparkline values={values} />}
      </div>
      {error && <span className="oz-rate__sub">Курс временно недоступен</span>}
    </div>
  );
}

/* ── Listing card ─────────────────────────────────────────────────── */
function ListingCard({ listing, isOwn, onContact, onEdit, onWithdraw }) {
  const direction = listing.direction;
  const from = directionFrom(direction);
  const to = directionTo(direction);
  const profile = listing.profile;
  const marketRate = DEMO_RATE.rate;
  const equivalent = equivalentAmount(listing.amount, from, marketRate, listing.rate);
  const displayName = profile.displayName?.trim() || formatPhoneMasked(profile.phone);
  return (
    <article className="oz-card">
      <div className="oz-card__top">
        <div className="oz-card__who">
          <Avatar url={profile.avatarUrl} name={profile.displayName} phone={profile.phone} />
          <div className="oz-card__identity">
            <span className="oz-card__name">{displayName}</span>
            <span className="oz-card__rating">
              {profile.ratingCount > 0 && profile.ratingAvg !== null
                ? `★ ${profile.ratingAvg.toFixed(1)} · ${profile.ratingCount}`
                : "Новый"}
            </span>
          </div>
        </div>
        <VerificationBadge tier={profile.verificationTier} />
      </div>

      <div>
        <div className="oz-card__amount">
          <span className="oz-card__direction" aria-hidden>{SYMBOL[from]} → {SYMBOL[to]}</span>
          {formatAmountBare(listing.amount)}
        </div>
        <div className="oz-card__rateline">
          {listing.rate !== null ? `по курсу ${formatRate(listing.rate)}` : "по рынку"}
        </div>
        <div className="oz-card__equivalent">≈ {formatAmount(equivalent, to)}</div>
        {listing.note && <p className="oz-card__note">{listing.note}</p>}
      </div>

      <div className="oz-card__bottom">
        <span className="oz-card__time">{listing.createdAt}</span>
        <div className="oz-card__actions">
          {isOwn ? (
            <>
              <button className="oz-secondary-btn-sm" onClick={() => onEdit?.(listing.id)}>Редактировать</button>
              <button className="oz-secondary-btn-sm" onClick={() => onWithdraw?.(listing.id)}>Снять</button>
            </>
          ) : (
            <button className="oz-soft-btn-sm" onClick={() => onContact?.(listing.id)}>Связаться</button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Router context (super-tiny) ──────────────────────────────────── */
const RouterCtx = createContext({ path: "/", push: () => {}, back: () => {} });
function useRouter() { return useContext(RouterCtx); }

function RouterProvider({ initialPath = "/", children }) {
  const [stack, setStack] = useState([initialPath]);
  const path = stack[stack.length - 1];
  const push = (p) => setStack((s) => [...s, p]);
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const replace = (p) => setStack((s) => [...s.slice(0, -1), p]);
  return (
    <RouterCtx.Provider value={{ path, push, back, replace }}>
      {children}
    </RouterCtx.Provider>
  );
}

/* ── Phone-shape device frame ─────────────────────────────────────── */
function Phone({ children }) {
  return (
    <div className="oz-device">
      <div className="oz-device__statusbar">
        <span className="oz-device__time">9:41</span>
        <span className="oz-device__signal">
          <span>●●●●●</span>
          <span style={{ marginLeft: 6, fontSize: 11 }}>5G</span>
          <span style={{ marginLeft: 8 }}>▮▮▮</span>
        </span>
      </div>
      <div className="oz-device__viewport">
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  React, useState, useEffect, useRef, useContext, createContext,
  CURRENT_USER, DEMO_LISTINGS, DEMO_RATE, SYMBOL,
  directionFrom, directionTo,
  formatAmount, formatAmountBare, formatRate, formatPhoneMasked, equivalentAmount,
  BrandMark, Avatar, VerificationBadge,
  RateWidget, RateSparkline, DirectionTriangle,
  ListingCard,
  RouterCtx, useRouter, RouterProvider,
  Phone,
});
