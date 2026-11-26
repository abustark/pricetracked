"use client";

import { useState } from "react";
import Link from "next/link";
import type { AlertEventView } from "@/lib/types";
import { Icon } from "@/components/Icons";

/**
 * In-app alert list with mark-read and dismiss. All mutations go through the
 * /api/alerts handlers so quota and ownership checks stay server-side.
 */
export function AlertsList({ initialAlerts }: { initialAlerts: AlertEventView[] }) {
  const [alerts, setAlerts] = useState<AlertEventView[]>(initialAlerts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const unread = alerts.filter((a) => !a.read).length;

  async function markRead(id: string) {
    setBusyId(id);
    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error("Failed to update alert");
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setBusyId("all");
    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      if (!response.ok) throw new Error("Failed to update alerts");
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(id: string) {
    setBusyId(id);
    try {
      const response = await fetch("/api/alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error("Failed to dismiss alert");
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {unread > 0 ? (
        <div className="panel-heading-row">
          <span className="list-count">{unread} unread of {alerts.length}</span>
          <button
            type="button"
            className="button ghost"
            onClick={markAllRead}
            disabled={busyId === "all"}
          >
            <Icon name="check" size={14} /> Mark all read
          </button>
        </div>
      ) : (
        <div className="panel-heading-row">
          <span className="list-count">{alerts.length} alerts</span>
        </div>
      )}

      <section className="panel" aria-label="Alerts">
        <div className="samples">
          {alerts.map((alert) => {
            const reached = alert.observedPrice <= alert.target;
            return (
              <div className={`alert-row ${alert.read ? "is-read" : ""}`} key={alert.id}>
                <span className={`status-dot ${reached ? "fresh" : ""}`} aria-hidden="true" />
                <div className="alert-body">
                  <div>
                    <strong>
                      {formatMoney(alert.observedPrice, alert.currency)}
                      {reached ? " · target reached" : " · below target"}
                    </strong>
                    <small>
                      {alert.productTitle}
                      {alert.productStoreLabel ? ` · ${alert.productStoreLabel}` : ""}
                      {` · target ${formatMoney(alert.target, alert.currency)} · ${formatDate(alert.observedAt)}`}
                    </small>
                  </div>
                  <div className="alert-actions">
                    {!alert.read ? (
                      <button
                        type="button"
                        className="button ghost small"
                        onClick={() => markRead(alert.id)}
                        disabled={busyId === alert.id}
                      >
                        <Icon name="check" size={13} /> Mark read
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => dismiss(alert.id)}
                      disabled={busyId === alert.id}
                    >
                      <Icon name="trash" size={13} /> Dismiss
                    </button>
                    <Link className="button ghost small" href={`/products/${alert.productId}`}>
                      <Icon name="arrow" size={13} /> View
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
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
