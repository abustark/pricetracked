import { describe, expect, it } from "vitest";
import { extractRequestedIdentity, parseProductHtml } from "@/lib/scanner";

const PHONE_URL = "https://www.amazon.in/dp/B0DGJ9N27P";

function jsonLd(product: Record<string, unknown>): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(product)}</script></head><body></body></html>`;
}

describe("parser identity binding", () => {
  it("selects the matched product when a recommendation JSON-LD appears first", () => {
    const html = [
      jsonLd({
        "@type": "Product",
        name: "Cable",
        sku: "B0CABLEXX",
        offers: { "@type": "Offer", price: "199", priceCurrency: "INR" }
      }),
      jsonLd({
        "@type": "Product",
        name: "Phone",
        sku: "B0DGJ9N27P",
        offers: {
          "@type": "Offer",
          price: "93990",
          priceCurrency: "INR",
          availability: "https://schema.org/InStock"
        }
      })
    ].join("");

    const parsed = parseProductHtml(html, "amazon", { requestedUrl: PHONE_URL });

    expect(parsed.title).toBe("Phone");
    expect(parsed.price).toBe(93990);
    expect(parsed.identityVerified).toBe(true);
    expect(parsed.extractionMethod).toBe("jsonld-identity");
  });

  it("fails closed when priced candidates do not match the requested product", () => {
    const html = [
      jsonLd({
        "@type": "Product",
        name: "Cable",
        sku: "B0CABLEXX",
        offers: { "@type": "Offer", price: "199", priceCurrency: "INR" }
      }),
      jsonLd({
        "@type": "Product",
        name: "Other Phone",
        sku: "B0OTHER000",
        offers: { "@type": "Offer", price: "59999", priceCurrency: "INR" }
      })
    ].join("");

    expect(() => parseProductHtml(html, "amazon", { requestedUrl: PHONE_URL })).toThrow(
      /multiple priced products/i
    );
  });

  it("accepts a single unverifiable candidate, flagged as such", () => {
    const html = jsonLd({
      "@type": "Product",
      name: "Fixture Phone 256GB",
      offers: { "@type": "Offer", price: "12999", priceCurrency: "INR" }
    });

    const parsed = parseProductHtml(html, "amazon", { requestedUrl: PHONE_URL });

    expect(parsed.price).toBe(12999);
    expect(parsed.identityVerified).toBe(false);
  });

  it("extracts identity tokens from product URLs", () => {
    expect(extractRequestedIdentity("https://www.amazon.in/dp/B0dgj9n27p", "amazon")).toBe(
      "B0DGJ9N27P"
    );
    expect(extractRequestedIdentity("https://www.amazon.in/gp/product/B0ABCDEFGH", "amazon")).toBe(
      "B0ABCDEFGH"
    );
    expect(extractRequestedIdentity("https://www.flipkart.com/p/itmabc123", "flipkart")).toBe(
      "itmabc123"
    );
    expect(extractRequestedIdentity("https://www.myntra.com/shoes/1234567/buy", "myntra")).toBe(
      "1234567"
    );
  });
});

describe("offer-scoped availability", () => {
  it("reads availability from the selected offer, not whole-page text", () => {
    const html = `<html><head>${jsonLd({
      "@type": "Product",
      name: "Phone",
      sku: "B0DGJ9N27P",
      offers: {
        "@type": "Offer",
        price: "93990",
        priceCurrency: "INR",
        availability: "https://schema.org/InStock"
      }
    })}</head><body><p>Currently unavailable</p><p>Sold out</p></body></html>`;

    const parsed = parseProductHtml(html, "amazon", { requestedUrl: PHONE_URL });

    expect(parsed.availability).toBe("in_stock");
    expect(parsed.inStock).toBe(true);
  });

  it("reports out_of_stock from the selected offer", () => {
    const html = jsonLd({
      "@type": "Product",
      name: "Phone",
      sku: "B0DGJ9N27P",
      offers: {
        "@type": "Offer",
        price: "93990",
        priceCurrency: "INR",
        availability: "https://schema.org/OutOfStock"
      }
    });

    const parsed = parseProductHtml(html, "amazon", { requestedUrl: PHONE_URL });

    expect(parsed.availability).toBe("out_of_stock");
    expect(parsed.inStock).toBe(false);
  });

  it("keeps unknown distinct from out_of_stock when no structured availability exists", () => {
    const html = `<html><head><title>Item</title></head><body>
      <div class="sale-price">999</div>
      <p>Currently unavailable</p>
    </body></html>`;

    const parsed = parseProductHtml(html, "other");

    expect(parsed.availability).toBe("unknown");
    expect(parsed.inStock).toBeUndefined();
  });
});
