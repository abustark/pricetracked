"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import type { AlertEventView } from "@/lib/types";

type Props = {
  initialAlerts: AlertEventView[];
};

/**
 * Compact in-app alert history for the watchlist. In-app only: nothing here
 * sends email or push notifications. Each event links to its product detail
 * page and can be marked read or dismissed.
 */
export function AlertsPanel({ initialAlerts }: Props) {
  const [alerts, setAlerts] = useState<AlertEventView[]>(initialAlerts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = alerts.filter((alert) => !alert.read).length;

  async function markRead(id: string) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!response.ok) {
        throw new Error("Could not mark the alert as read.");
      }
      setAlerts((current) => current.map((alert) => (alert.id === id ? { ...alert, read: true } : alert)));
    } catch {
      setError("Could not mark the alert as read. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError("");
    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      if (!response.ok) {
        throw new Error("Could not mark alerts as read.");
      }
      setAlerts((current) => current.map((alert) => ({ ...alert, read: true })));
    } catch {
      setError("Could not mark alerts as read. Please try again.");
    } finally {
      setMarkingAll(false);
    }
  }

  async function dismiss(id: string) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Could not dismiss the alert.");
      }
      setAlerts((current) => current.filter((alert) => alert.id !== id));
    } catch {
      setError("Could not dismiss the alert. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="alerts-panel" id="alerts" role="region" aria-labelledby="alerts-heading">
      <div className="alerts-head">
        <div className="alerts-head-title">
          <span className="alerts-icon-wrap">
            <Icon name="bell" size={16} />
          </span>
          <div>
            <h3 id="alerts-heading">Price alerts</h3>
            <p>In-app only — no email or push notifications.</p>
          </div>
        </div>
        <div className="alerts-head-actions">
          {unreadCount > 0 ? (
            <span className="alerts-unread" aria-label={`${unreadCount} unread alerts`}>
              {unreadCount} unread
            </span>
          ) : null}
          {unreadCount > 0 ? (
            <button
              type="button"
              className="alerts-mark-all"
              onClick={markAllRead}
              disabled={markingAll}
            >
              {markingAll ? "Marking…" : "Mark all read"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="alerts-error" role="status" aria-live="polite">
          {error}
        </p>
      ) : null}

      {alerts.length === 0 ? (
        <div className="alerts-empty">
          <Icon name="bell" size={18} />
          <p>
            No alerts yet. Set a target price on a product and any price that reaches it will appear
            here.
          </p>
        </div>
      ) : (
        <ul className="alerts-list">
          {alerts.map((alert) => (
            <li className={`alert-item ${alert.read ? "read" : "unread"}`} key={alert.id}>
              <Link
                className="alert-item-main"
                href={`/products/${alert.productId}`}
                aria-label={`${alert.productTitle}: price ${formatMoney(alert.observedPrice, alert.currency)} reached your target of ${formatMoney(alert.target, alert.currency)}`}
              >
                <span className="alert-item-title">
                  <span className="alert-item-dot" aria-hidden="true" />
                  {alert.productTitle}
                </span>
                <span className="alert-item-meta">
                  <strong>{formatMoney(alert.observedPrice, alert.currency)}</strong> met your target of{" "}
                  {formatMoney(alert.target, alert.currency)}
                  {alert.productStoreLabel ? ` · ${alert.productStoreLabel}` : ""}
                </span>
                <span className="alert-item-time" suppressHydrationWarning>
                  {formatDate(alert.observedAt)}
                  {alert.read ? "" : " · Unread"}
                </span>
              </Link>
              <div className="alert-item-actions">
                {!alert.read ? (
                  <button
                    type="button"
                    className="alert-action"
                    onClick={() => markRead(alert.id)}
                    disabled={busyId === alert.id}
                    aria-label={`Mark alert for ${alert.productTitle} as read`}
                  >
                    Mark read
                  </button>
                ) : null}
                <button
                  type="button"
                  className="alert-action dismiss"
                  onClick={() => dismiss(alert.id)}
                  disabled={busyId === alert.id}
                  aria-label={`Dismiss alert for ${alert.productTitle}`}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
