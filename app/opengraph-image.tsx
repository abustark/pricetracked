import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PriceTracked - price history for online shopping";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#effcf8",
          background:
            "radial-gradient(circle at 88% 12%, rgba(25, 182, 154, 0.22), transparent 420px), linear-gradient(135deg, #0a1917 0%, #123b37 100%)",
          fontFamily: "sans-serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "linear-gradient(145deg, #0b7c70, #19b69a)"
            }}
          >
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <path
                d="M8 22.5 13 17l3.5 3.5L24 12"
                stroke="#ffffff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 12h5v5"
                stroke="#ffffff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>PriceTracked</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02 }}>
            Track prices
            <br />
            before you buy.
          </div>
          <div style={{ fontSize: 24, color: "#a9d8ce" }}>
            Price history for Amazon · Flipkart · Myntra · AJIO
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
