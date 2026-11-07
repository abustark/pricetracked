"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icons";

type Props = {
  productId: string;
  currentPrice?: number;
  currency: string;
  initialTargetPrice?: number;
  initialTargetAlertEnabled?: boolean;
  lowestPrice?: number;
  mrp?: number;
};

export function TargetPriceAlert({
  productId,
  currentPrice,
  currency,
  initialTargetPrice,
  initialTargetAlertEnabled = true,
  lowestPrice,
  mrp
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [targetPrice, setTargetPrice] = useState<number | null>(initialTargetPrice ?? null);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(initialTargetAlertEnabled);
  const [inputVal, setInputVal] = useState<string>(
    initialTargetPrice ? String(initialTargetPrice) : ""
  );
  const [isEditing, setIsEditing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleSave = async (priceToSave: number | null) => {
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPrice: priceToSave,
          targetAlertEnabled: priceToSave ? true : false
        })
      });

      if (!res.ok) {
        throw new Error("Failed to update target price");
      }

      const payload = (await res.json().catch(() => null)) as
        | { product?: { targetPriceReached?: boolean } | null }
        | null;
      const alreadyBelow = payload?.product?.targetPriceReached === true;

      setTargetPrice(priceToSave);
      setAlertsEnabled(priceToSave ? true : alertsEnabled);
      setInputVal(priceToSave ? String(priceToSave) : "");
      setIsEditing(false);
      setStatusMsg(
        priceToSave
          ? alreadyBelow
            ? "Target saved — the current price is already at or below it, so it shows as reached."
            : "Target price saved!"
          : "Target alert cleared."
      );
      setTimeout(() => setStatusMsg(null), 3500);

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setStatusMsg("Error updating target. Please try again.");
    }
  };

  const handleToggleEnabled = async () => {
    const nextEnabled = !alertsEnabled;
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAlertEnabled: nextEnabled })
      });
      if (!res.ok) {
        throw new Error("Failed to update alert state");
      }
      setAlertsEnabled(nextEnabled);
      setStatusMsg(nextEnabled ? "Alert resumed — you'll be alerted at your target." : "Alert paused — the target is kept and price tracking continues.");
      setTimeout(() => setStatusMsg(null), 3500);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setStatusMsg("Error updating alert. Please try again.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(inputVal.trim());
    if (isNaN(num) || num <= 0) {
      handleSave(null);
    } else {
      handleSave(Math.round(num));
    }
  };

  const presets = currentPrice
    ? [
        { label: "-5%", price: Math.round(currentPrice * 0.95) },
        { label: "-10%", price: Math.round(currentPrice * 0.9) },
        { label: "-15%", price: Math.round(currentPrice * 0.85) },
        ...(lowestPrice && lowestPrice < currentPrice
          ? [{ label: `Lowest (${formatCurrency(lowestPrice)})`, price: lowestPrice }]
          : [])
      ]
    : [];

  const isTargetReached =
    currentPrice != null && targetPrice != null && currentPrice <= targetPrice;
  const difference =
    currentPrice != null && targetPrice != null && currentPrice > targetPrice
      ? currentPrice - targetPrice
      : 0;
  const diffPercent =
    currentPrice && difference > 0 ? Math.round((difference / currentPrice) * 100) : 0;

  return (
    <div className="target-alert-card" role="region" aria-label="Price drop target alert">
      <div className="target-alert-header">
        <div className="target-alert-title">
          <span className="target-icon-wrap">
            <Icon name="bell" size={16} />
          </span>
          <div>
            <strong>Price Drop Alert</strong>
            <p>Set a target to get an in-app alert when the price reaches it</p>
          </div>
        </div>
        {targetPrice && !isEditing ? (
          <div className="target-alert-actions">
            <span
              className={`target-alert-state ${alertsEnabled ? "on" : "off"}`}
              aria-label={alertsEnabled ? "Alert is on" : "Alert is paused"}
            >
              <span className="dot" aria-hidden="true" />
              {alertsEnabled ? "Alert on" : "Paused"}
            </span>
            <button
              type="button"
              className="target-edit-btn"
              onClick={handleToggleEnabled}
              disabled={isPending}
              aria-label={alertsEnabled ? "Pause target alert" : "Resume target alert"}
            >
              {alertsEnabled ? "Pause" : "Resume"}
            </button>
            <button
              type="button"
              className="target-edit-btn"
              onClick={() => setIsEditing(true)}
              aria-label="Edit target price"
            >
              Edit
            </button>
          </div>
        ) : null}
      </div>

      {statusMsg ? <div className="target-status-banner" role="status" aria-live="polite">{statusMsg}</div> : null}

      {targetPrice && !alertsEnabled && !isEditing ? (
        <div className="target-paused-banner" role="status">
          <Icon name="bell" size={14} />
          <span>
            Alert paused. Your target of <strong>{formatCurrency(targetPrice)}</strong> is kept and
            price tracking continues — no in-app alert will be created until you resume.
          </span>
        </div>
      ) : null}

      {/* Target status display when targetPrice is set and not editing */}
      {targetPrice && !isEditing ? (
        <div className="target-summary">
          {isTargetReached ? (
            <div className="target-reached-box">
              <div className="target-reached-pill">
                <span className="dot pulse" aria-hidden="true" /> 🎯 Target Price Reached!
              </div>
              <p>
                Current price <strong>{formatCurrency(currentPrice!)}</strong> is at or below your
                target of <strong>{formatCurrency(targetPrice)}</strong>!
              </p>
              <p className="target-reached-note">
                This is an in-app alert only — no email or push notification is sent. When a scan
                detects the price crossing your target, it is saved to your alert history on the
                watchlist.{" "}
                <Link href="/#alerts">View alert history</Link>
              </p>
            </div>
          ) : (
            <div className="target-progress-box">
              <div className="target-progress-info">
                <span>
                  Target: <strong>{formatCurrency(targetPrice)}</strong>
                </span>
                <span className="target-diff">
                  {formatCurrency(difference)} away ({diffPercent}% drop needed)
                </span>
              </div>
              <div className="target-bar" role="progressbar" aria-valuenow={100 - diffPercent} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="target-bar-fill"
                  style={{ width: `${Math.max(10, Math.min(100, 100 - diffPercent))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Input form when no target or editing */}
      {(!targetPrice || isEditing) ? (
        <form onSubmit={handleSubmit} className="target-form">
          <div className="target-input-row">
            <div className="target-input-wrap">
              <span className="target-currency-prefix">{currency === "INR" ? "₹" : currency}</span>
              <input
                type="number"
                name="targetPrice"
                autoComplete="off"
                min="1"
                step="1"
                placeholder={currentPrice ? `e.g. ${Math.round(currentPrice * 0.9)}…` : "Target amount…"}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="target-input"
                aria-label="Target price in currency"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="button button-primary target-save-btn"
            >
              {isPending ? "Saving…" : "Set Alert"}
            </button>
            {targetPrice ? (
              <button
                type="button"
                className="button button-ghost"
                onClick={() => handleSave(null)}
                disabled={isPending}
              >
                Clear
              </button>
            ) : null}
            {isEditing ? (
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            ) : null}
          </div>

          {/* Quick preset buttons */}
          {presets.length > 0 ? (
            <div className="target-presets">
              <span className="target-preset-label">Quick set:</span>
              <div className="target-preset-chips">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="target-chip"
                    onClick={() => {
                      setInputVal(String(preset.price));
                      handleSave(preset.price);
                    }}
                    disabled={isPending}
                  >
                    {preset.label} ({formatCurrency(preset.price)})
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
