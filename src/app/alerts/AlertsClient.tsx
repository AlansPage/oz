"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import type { AlertSubscription, Direction } from "@/lib/types";
import { AlertCreateSheet } from "./AlertCreateSheet";

type Props = {
  userId: string;
  initialAlerts: AlertSubscription[];
  hasTelegramLink: boolean;
  initialDirection: Direction | null;
  initialCreate: boolean;
};

const DIR_SYMBOL: Record<Direction, string> = {
  kzt_to_krw: "₸ → ₩",
  krw_to_kzt: "₩ → ₸",
};

function fromCurrency(direction: Direction): "KZT" | "KRW" {
  return direction === "kzt_to_krw" ? "KZT" : "KRW";
}

function rangeText(
  amountMin: number | null,
  amountMax: number | null,
  direction: Direction,
): string {
  const ccy = fromCurrency(direction);
  const symbol = ccy === "KZT" ? "₸" : "₩";
  const fmt = (n: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
  if (amountMin != null && amountMax != null)
    return `${fmt(amountMin)} — ${fmt(amountMax)} ${symbol}`;
  if (amountMin != null) return `от ${fmt(amountMin)} ${symbol}`;
  if (amountMax != null) return `до ${fmt(amountMax)} ${symbol}`;
  return "любая сумма";
}

function cooldownText(min: number): string {
  if (min < 60) return `пауза ${min} мин между уведомлениями`;
  const hours = min / 60;
  return `пауза ${hours} ч между уведомлениями`;
}

export function AlertsClient({
  userId,
  initialAlerts,
  hasTelegramLink,
  initialDirection,
  initialCreate,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [alerts, setAlerts] = useState<AlertSubscription[]>(initialAlerts);
  const [createOpen, setCreateOpen] = useState(initialCreate);
  const [createDefaultDir, setCreateDefaultDir] = useState<Direction | null>(
    initialDirection,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // The delete-confirm sheet below renders inline (not a *Sheet component),
  // so it takes the body scroll lock here.
  useBodyScrollLock(pendingDeleteId !== null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Strip the create=1 querystring after the sheet is open so a reload
  // doesn't auto-open it again.
  useEffect(() => {
    if (initialCreate && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("create");
      url.searchParams.delete("direction");
      window.history.replaceState({}, "", url.toString());
    }
  }, [initialCreate]);

  async function toggleActive(alert: AlertSubscription) {
    if (busyId) return;
    setBusyId(alert.id);
    setError(null);
    const nextActive = !alert.active;
    const { error: err } = await supabase
      .from("alert_subscriptions")
      .update({ active: nextActive })
      .eq("id", alert.id);
    setBusyId(null);
    if (err) {
      setError("Не удалось обновить. Попробуйте ещё раз.");
      return;
    }
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, active: nextActive } : a)),
    );
  }

  async function confirmDelete(alertId: string) {
    if (busyId) return;
    setBusyId(alertId);
    setError(null);
    const { error: err } = await supabase
      .from("alert_subscriptions")
      .delete()
      .eq("id", alertId);
    setBusyId(null);
    setPendingDeleteId(null);
    if (err) {
      setError("Не удалось удалить. Попробуйте ещё раз.");
      return;
    }
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }

  return (
    <section className="oz-alerts">
      <h1 className="oz-alerts__heading">Оповещения</h1>
      <p className="oz-alerts__lede">
        Получайте уведомление в Telegram, когда появляются подходящие
        объявления. Не больше 10 уведомлений в день.
      </p>

      {!hasTelegramLink && (
        <div className="oz-alerts__tgbanner">
          Чтобы получать оповещения, войдите в @ozauth_bot хотя бы один раз.{" "}
          <a
            href="https://t.me/ozauth_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="oz-alerts__tglink"
          >
            Открыть бот
          </a>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="oz-alerts__empty">
          <p>
            Создайте первое оповещение — мы пришлём вам Telegram, когда
            появится подходящее объявление.
          </p>
          <button
            type="button"
            className="oz-btn oz-btn--primary oz-btn--lg"
            onClick={() => {
              setCreateDefaultDir(null);
              setCreateOpen(true);
            }}
          >
            Создать оповещение
          </button>
        </div>
      ) : (
        <>
          <div className="oz-alerts__list">
            {alerts.map((a) => (
              <article
                key={a.id}
                className={
                  "oz-alerts__card" + (a.active ? "" : " oz-alerts__card--off")
                }
              >
                <div className="oz-alerts__cardmain">
                  <span className="oz-alerts__dir">
                    {DIR_SYMBOL[a.direction]}
                  </span>
                  <span className="oz-alerts__range">
                    {rangeText(
                      a.amount_min != null ? Number(a.amount_min) : null,
                      a.amount_max != null ? Number(a.amount_max) : null,
                      a.direction,
                    )}
                  </span>
                  {a.rate_better_than != null && (
                    <span className="oz-alerts__rate">
                      курс не хуже {String(a.rate_better_than).replace(".", ",")}
                    </span>
                  )}
                  <span className="oz-alerts__cooldown">
                    {cooldownText(a.cooldown_minutes)}
                  </span>
                </div>
                <div className="oz-alerts__cardactions">
                  <button
                    type="button"
                    className={
                      "oz-alerts__toggle" +
                      (a.active ? " oz-alerts__toggle--on" : "")
                    }
                    onClick={() => toggleActive(a)}
                    disabled={busyId === a.id}
                    aria-label={a.active ? "Отключить" : "Включить"}
                  >
                    <span className="oz-alerts__toggle-dot" />
                  </button>
                  <button
                    type="button"
                    className="oz-alerts__trash"
                    onClick={() => setPendingDeleteId(a.id)}
                    disabled={busyId === a.id}
                    aria-label="Удалить"
                  >
                    ×
                  </button>
                </div>
              </article>
            ))}
          </div>
          <button
            type="button"
            className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg oz-alerts__create"
            onClick={() => {
              setCreateDefaultDir(null);
              setCreateOpen(true);
            }}
          >
            Создать оповещение
          </button>
        </>
      )}

      {error && <p className="oz-alerts__error">{error}</p>}

      <AlertCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        userId={userId}
        defaultDirection={createDefaultDir}
        onCreated={(alert) => setAlerts((prev) => [alert, ...prev])}
      />

      {pendingDeleteId && (
        <>
          <div
            className="oz-sheet-scrim oz-sheet-scrim--stacked"
            onClick={() => setPendingDeleteId(null)}
            aria-hidden
          />
          <div
            className="oz-sheet oz-sheet--stacked"
            role="dialog"
            aria-modal="true"
            aria-labelledby="oz-alert-delete-title"
          >
            <div className="oz-sheet__handle" />
            <h2 id="oz-alert-delete-title" className="oz-sheet__title">
              Удалить оповещение?
            </h2>
            <p className="oz-sheet__subtitle">Это действие нельзя отменить.</p>
            <div className="oz-confirm__actions">
              <button
                type="button"
                className="oz-btn oz-btn--ghost"
                onClick={() => setPendingDeleteId(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="oz-btn oz-btn--primary"
                onClick={() => confirmDelete(pendingDeleteId)}
              >
                Удалить
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
