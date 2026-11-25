"use client";

import { useEffect, useState } from "react";
import type { DropItem } from "@/lib/recent-drops";

/**
 * Hero "Current discounts vs MRP" tape — fetches 3 live-priced products from
 * /api/recent-drops. Selection + prices stay identical for 6h per browser
 * (rotation window handled server-side via cookie).
 *
 * The reductions shown are current discounts against the retailer's MRP, not
 * observed historical price drops (there is no shared drop feed yet), so the
 * label says so honestly.
 */
export function RecentDrops() {
  const [items, setItems] = useState<DropItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/recent-drops")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive) setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (items === null) {
    return (
      <div className="hero-tape" aria-hidden="true">
        <span className="tape-label">Current discounts vs MRP</span>
        <span className="tape-chip tape-skeleton" />
        <span className="tape-chip tape-skeleton" />
        <span className="tape-chip tape-skeleton" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="hero-tape" aria-hidden="true">
      <span className="tape-label">Current discounts vs MRP</span>
      {items.map((item) => (
        <span className="tape-chip" key={item.url}>
          <span className={`store-dot ${item.store}`} /> {item.name} <strong>₹{item.price.toLocaleString("en-IN")}</strong>{" "}
          {item.drop ? <span className="tape-drop">{item.drop}</span> : null}
        </span>
      ))}
    </div>
  );
}
