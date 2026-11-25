import type { BuyAdvice } from "@/lib/types";
import { Icon } from "@/components/Icons";

type Props = {
  advice?: BuyAdvice;
  currency: string;
};

export function BuyAdviceCard({ advice, currency }: Props) {
  if (!advice) return null;

  const { verdict, headline, reason, score, rangePosition, recentTrend, recentChangeAmount, potentialSavings, limitedHistory } =
    advice;

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  const getVerdictTheme = () => {
    switch (verdict) {
      case "buy_now":
        return {
          label: "Best Time to Buy",
          badge: "BUY NOW",
          colorClass: "verdict-buy",
          iconName: "spark" as const,
          barColor: "var(--success)"
        };
      case "fair_price":
        return {
          label: "Fair Market Price",
          badge: "FAIR PRICE",
          colorClass: "verdict-fair",
          iconName: "clock" as const,
          barColor: "#3b82f6"
        };
      case "wait":
        return {
          label: "Consider Waiting",
          badge: "WAIT FOR DROP",
          colorClass: "verdict-wait",
          iconName: "arrowUp" as const,
          barColor: "var(--danger)"
        };
    }
  };

  const theme = getVerdictTheme();

  return (
    <div className={`advice-card ${theme.colorClass}`} role="region" aria-label="Buying advice" data-reveal>
      <div className="advice-main">
        <div className="advice-badge-row">
          <span className="advice-badge">
            <span className="dot pulse" aria-hidden="true" /> {theme.badge}
          </span>
          <span className="advice-score-tag">
            Deal Score: <strong>{score}</strong>/100
          </span>
        </div>

        <h3 className="advice-headline">{headline}</h3>
        <p className="advice-reason">{reason}</p>

        <div className="advice-signals">
          {/* Trend signal */}
          <div className="advice-signal-chip">
            <span className="signal-icon">
              {recentTrend === "falling" ? "📉" : recentTrend === "rising" ? "📈" : "⚖️"}
            </span>
            <span>
              {recentTrend === "falling"
                ? `Dropping recently ${recentChangeAmount ? `(-${formatMoney(recentChangeAmount)})` : ""}`
                : recentTrend === "rising"
                ? `Increased recently ${recentChangeAmount ? `(+${formatMoney(recentChangeAmount)})` : ""}`
                : "Price currently steady"}
            </span>
          </div>

          {/* Observed range position (a range position, not a statistical
              percentile) — suppressed while the history is still too sparse
              to interpret. */}
          {limitedHistory ? (
            <div className="advice-signal-chip">
              <Icon name="trend" size={13} />
              <span>Building history — too few observations to rank</span>
            </div>
          ) : (
            <div className="advice-signal-chip">
              <Icon name="trend" size={13} />
              <span>
                {rangePosition <= 5
                  ? "At the low end of the observed range"
                  : rangePosition <= 20
                  ? "In the bottom 20% of the observed range"
                  : rangePosition >= 80
                  ? "Near the high end of the observed range"
                  : "Within the observed price band"}
              </span>
            </div>
          )}

          {/* Savings indicator */}
          {potentialSavings ? (
            <div className="advice-signal-chip highlight">
              <Icon name="zap" size={13} />
              <span>{formatMoney(potentialSavings)} off historical peak</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Visual Deal Meter */}
      <div className="advice-meter-col">
        <div className="advice-gauge">
          <div className="gauge-circle">
            <svg viewBox="0 0 36 36" className="gauge-svg" aria-hidden="true">
              <path
                className="gauge-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="gauge-progress"
                strokeDasharray={`${score}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                style={{ stroke: theme.barColor }}
              />
            </svg>
            <div className="gauge-text">
              <span className="gauge-val">{score}</span>
              <span className="gauge-sub">/ 100</span>
            </div>
          </div>
          <span className="gauge-label">Deal Rating</span>
        </div>
      </div>
    </div>
  );
}
