// Mock mode (no keys): a watch's "Check now" re-reads its example page instead of failing on the missing
// Context.dev key, and the example flats sit in districts of the city asked about.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./helpers";
import { readListings, searchListings } from "@/lib/agent/research/listings";
import { readPrices, searchPrices } from "@/lib/agent/research/prices";

describe("mock re-reads (MODEL_PROVIDER=mock)", () => {
  it("re-reads the example flats page as it was, with the city's own districts", async () => {
    const search = await searchListings("Espoo");
    const page = search.pages[0];
    assert.deepEqual(page.listings.map((listing) => listing.district), ["Leppävaara", "Tapiola", "Matinkylä"]);
    const again = await readListings(page.url, { fresh: true, city: "Espoo" });
    assert.deepEqual(again.listings, page.listings);
    assert.equal((await readListings("https://example.com/elsewhere", { city: "Espoo" })).listings.length, 0);
    assert.deepEqual((await searchListings("Oulu")).pages[0].listings.map((listing) => listing.district), [null, null, null]);
  });

  it("re-reads the example offers page as it was", async () => {
    const page = (await searchPrices("iPhone 15")).pages[0];
    assert.deepEqual((await readPrices(page.url, "iPhone 15", { fresh: true })).listings, page.listings);
  });
});
