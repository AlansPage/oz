/* global React, useState, BrandMark, useRouter */

function LandingScreen() {
  const router = useRouter();
  return (
    <main style={{
      minHeight: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "48px 24px",
      background: "var(--bg)",
    }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", maxWidth: 320 }}>
        <BrandMark size={72} />
        <h1 style={{ margin: "24px 0 0", fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text)" }}>öz</h1>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.4, color: "var(--text-2)" }}>
          Обмен тенге и вон между своими в Корее.
        </p>
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <button
          className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
          onClick={() => router.push("/auth/phone")}
        >
          Войти
        </button>
        <p style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>
          Сообщество казахстанцев в Корее
        </p>
      </div>
    </main>
  );
}

window.LandingScreen = LandingScreen;
