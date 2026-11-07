import { ObjectId } from "mongodb";
import type { PriceSampleDocument } from "@/lib/types";

let dayCounter = 0;

/** Deterministic price sample. Dates are fixed to Jan 2026 UTC, one day apart. */
export function makeSample(
  price: number,
  options: {
    source?: PriceSampleDocument["source"];
    currency?: string;
    day?: number;
  } = {}
): PriceSampleDocument {
  const day = options.day ?? ++dayCounter;
  const capturedAt = new Date(Date.UTC(2026, 0, day, 12, 0, 0));

  return {
    _id: new ObjectId(),
    productId: new ObjectId(),
    price,
    currency: options.currency ?? "INR",
    source: options.source ?? "direct",
    capturedAt,
    createdAt: capturedAt
  };
}

/** HTML response with the given body + content type (for mocked fetch). */
export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

export const JSON_LD_PRODUCT_HTML = `<!doctype html>
<html>
  <head>
    <title>Fixture Product</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Fixture Phone 256GB",
        "image": "https://cdn.example.com/phone.jpg",
        "offers": {
          "@type": "Offer",
          "price": "12999",
          "priceCurrency": "INR",
          "highPrice": "15999"
        }
      }
    </script>
  </head>
  <body><h1>Fixture Phone</h1></body>
</html>`;
