/* global React, useState, useRouter, BrandMark */

function maskPhone(digits) {
  // digits is the 10-digit Kazakh number after +7
  const d = digits.slice(0, 10);
  let out = "";
  if (d.length > 0) out += "(" + d.slice(0, 3);
  if (d.length >= 3) out += ") ";
  if (d.length >= 3) out += d.slice(3, 6);
  if (d.length > 6) out += "-" + d.slice(6, 8);
  if (d.length > 8) out += "-" + d.slice(8, 10);
  return out;
}

function PhoneScreen() {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = digits.length === 10 && !submitting;
  const formatted = maskPhone(digits);

  function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => router.push("/auth/verify"), 350);
  }

  return (
    <main style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "32px 24px", background: "var(--bg)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          style={{ background: "none", border: 0, padding: 0, fontSize: 14, color: "var(--text-2)", cursor: "pointer" }}
          onClick={() => router.back()}
        >
          ← Назад
        </button>
        <BrandMark size={28} />
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 320, margin: "0 auto", width: "100%" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.005em", color: "var(--text)" }}>
          Ваш номер телефона
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-2)" }}>
          Отправим код в Telegram. SMS не используем.
        </p>

        <form onSubmit={onSubmit} style={{ marginTop: 32 }}>
          <label className="oz-sheet__label" htmlFor="phone-input">Номер</label>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500, color: "var(--text)"
            }}>+7</span>
            <input
              id="phone-input"
              className="oz-input"
              inputMode="numeric"
              autoFocus
              value={formatted}
              placeholder="(XXX) XXX-XX-XX"
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 10);
                setDigits(onlyDigits);
              }}
              style={{ paddingLeft: 42, fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
            style={{ marginTop: 24 }}
          >
            {submitting ? "Отправляем…" : "Отправить код"}
          </button>

          <p style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>
            Продолжая, вы соглашаетесь с условиями
          </p>
        </form>
      </div>
    </main>
  );
}

window.PhoneScreen = PhoneScreen;
