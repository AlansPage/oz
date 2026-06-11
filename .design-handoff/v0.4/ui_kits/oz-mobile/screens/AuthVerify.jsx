/* global React, useState, useEffect, useRef, useRouter, BrandMark */

function OtpBoxes({ value, onChange, hasError }) {
  const refs = useRef([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function setDigit(i, d) {
    const next = value.split("");
    while (next.length < 6) next.push("");
    next[i] = d.slice(0, 1);
    const newVal = next.join("").trim();
    onChange(newVal);
    if (d && i < 5) refs.current[i + 1]?.focus();
  }

  return (
    <div className="oz-otp-row">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={"oz-otp-box" + (hasError ? " is-error" : "")}
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (text) {
              e.preventDefault();
              onChange(text);
              const next = Math.min(text.length, 5);
              setTimeout(() => refs.current[next]?.focus(), 0);
            }
          }}
        />
      ))}
    </div>
  );
}

function VerifyScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(45);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function handleVerify(e) {
    e?.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    setTimeout(() => {
      if (code === "000000") {
        setError("Неверный или истёкший код.");
        setLoading(false);
      } else {
        router.replace("/feed");
      }
    }, 600);
  }

  // Auto-submit at 6 digits
  useEffect(() => {
    if (code.length === 6 && !loading && !error) handleVerify();
  }, [code]);

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
          Введите код из Telegram
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-2)" }}>
          Код отправлен на <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>+7 (777) ***-**-67</span>
        </p>

        <form onSubmit={handleVerify} style={{ marginTop: 32 }}>
          <OtpBoxes value={code} onChange={setCode} hasError={!!error} />

          {error && (
            <p style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "var(--error)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={code.length !== 6 || loading}
            className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
            style={{ marginTop: 24 }}
          >
            {loading ? "Проверяем…" : "Подтвердить"}
          </button>

          <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text-2)" }}>
            Не получили код?{" "}
            {cooldown > 0 ? (
              <span style={{ color: "var(--text-3)" }}>
                Отправить повторно через{" "}
                <span style={{ fontFamily: "var(--font-mono)" }}>{cooldown}с</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setCooldown(45)}
                style={{ background: "none", border: 0, padding: 0, color: "var(--text-2)", textDecoration: "underline", cursor: "pointer" }}
              >
                Отправить повторно
              </button>
            )}
          </p>

          <p style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "var(--text-3)" }}>
            Подсказка для прототипа: введите любые цифры (кроме 000000) → войдёте.
          </p>
        </form>
      </div>
    </main>
  );
}

window.OtpBoxes = OtpBoxes;
window.VerifyScreen = VerifyScreen;
