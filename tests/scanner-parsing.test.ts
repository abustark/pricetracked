import { describe, expect, it } from "vitest";
import { parseProductHtml } from "@/lib/scanner";
import { JSON_LD_PRODUCT_HTML } from "./fixtures";

describe("product HTML parsing", () => {
  it("reads JSON-LD product offers", () => {
    const parsed = parseProductHtml(JSON_LD_PRODUCT_HTML, "other");

    expect(parsed.title).toBe("Fixture Phone 256GB");
    expect(parsed.price).toBe(12999);
    expect(parsed.mrp).toBe(15999);
    expect(parsed.discountPercent).toBe(19);
    expect(parsed.currency).toBe("INR");
    expect(parsed.imageUrl).toBe("https://cdn.example.com/phone.jpg");
  });

  it("falls back to Open Graph metadata when JSON-LD is absent", () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Nike Pegasus 41" />
      <meta property="product:price:amount" content="4,999.00" />
      <meta property="product:price:currency" content="INR" />
      <meta property="og:image" content="https://cdn.example.com/shoe.jpg" />
    </head><body></body></html>`;

    const parsed = parseProductHtml(html, "other");

    expect(parsed.title).toBe("Nike Pegasus 41");
    expect(parsed.price).toBe(4999);
    expect(parsed.currency).toBe("INR");
    expect(parsed.imageUrl).toBe("https://cdn.example.com/shoe.jpg");
  });

  it("uses the Amazon adapter", () => {
    const html = `<html><head><title>Kindle Paperwhite</title></head><body>
      <span class="a-price-whole">1,299</span>
    </body></html>`;

    expect(parseProductHtml(html, "amazon").price).toBe(1299);
  });

  it("uses the Flipkart adapter", () => {
    const html = `<html><head><title>Sony Headphones</title></head><body>
      <div class="_30jeq3">₹1,499</div>
    </body></html>`;

    expect(parseProductHtml(html, "flipkart").price).toBe(1499);
  });

  it("uses the Myntra adapter", () => {
    const html = `<html><head><title>Running Shoes</title></head><body>
      <div class="pdp-price">₹899</div>
    </body></html>`;

    expect(parseProductHtml(html, "myntra").price).toBe(899);
  });

  it("uses the AJIO adapter", () => {
    const html = `<html><head><title>Casual Shirt</title></head><body>
      <div class="prod-sp">₹2,499</div>
    </body></html>`;

    expect(parseProductHtml(html, "ajio").price).toBe(2499);
  });

  it("uses the generic adapter for unknown stores", () => {
    const html = `<html><head><title>Generic Lamp</title></head><body>
      <div class="sale-price">$1,299.50</div>
    </body></html>`;

    expect(parseProductHtml(html, "other").price).toBe(1299.5);
  });

  it("returns no price when the page has none", () => {
    const html = `<html><head><title>Mystery Item</title></head><body><p>Coming soon</p></body></html>`;

    expect(parseProductHtml(html, "other").price).toBeUndefined();
  });

  it("ignores malformed prices instead of inventing one", () => {
    const html = `<html><head>
      <meta property="og:title" content="Broken Item" />
      <meta property="product:price:amount" content="N/A" />
    </head><body></body></html>`;

    expect(parseProductHtml(html, "other").price).toBeUndefined();
  });

  it("normalises currencies from JSON-LD", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type":"Product","name":"Dollar Item","offers":{"price":"19.99","priceCurrency":"USD"}}
      </script>
    </head><body></body></html>`;

    const parsed = parseProductHtml(html, "other");
    expect(parsed.price).toBe(19.99);
    expect(parsed.currency).toBe("USD");
  });

  it("marks an out-of-stock product", () => {
    const html = `<html><head><title>Sold Out Item</title></head><body>
      <div class="sale-price">999</div>
      <p>Currently unavailable</p>
    </body></html>`;

    expect(parseProductHtml(html, "other").inStock).toBe(false);
  });
});
