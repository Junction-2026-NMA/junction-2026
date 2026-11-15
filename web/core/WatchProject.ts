// One project in detail: the answer of `GET /api/watch/:id?customerId=` on the newer backend (lib/types.ts
// `WatchProject`, lib/watch/project.ts). Beside the watch and its findings it carries `currentMatches`: the listings
// last read that meet the requirements now, cheapest first, each with its housing effect (flats only). Today's
// hosted backend has no such route (404), so a screen must work without it.
//
// Decoding is tolerant, as in WatchModels: a match without a listing is skipped, a housing effect that is not an
// object is null, and only a body that is not an object at all throws.
import { DecodingError, JSONRead } from "./Models";
import { type HousingEffect, Listing, PropertyWatch, WatchNotification } from "./WatchModels";

/** A listing that fits the requirements as last read, and the total effect of moving in (null for a price watch). */
export interface CurrentMatch {
  listing: Listing;
  housing: HousingEffect | null;
}

export interface WatchProject {
  customerId?: string | null;
  watch: PropertyWatch | null;
  notifications: WatchNotification[];
  unread?: number | null;
  currentMatches: CurrentMatch[];
  /** `cron` when a scheduled review runs while the app is closed; `on-open` otherwise. */
  scheduler?: string | null;
}

const decodeMatch = (json: unknown): CurrentMatch | null => {
  if (!JSONRead.isObject(json)) return null;
  const listing = Listing.decode(json.listing);
  if (!listing) return null;
  return { listing, housing: JSONRead.isObject(json.housing) ? json.housing : null };
};

export const CurrentMatch = { decode: decodeMatch } as const;

export const WatchProject = {
  decode(json: unknown): WatchProject {
    if (!JSONRead.isObject(json)) throw new DecodingError("Expected an object.");
    const list = (value: unknown) => (Array.isArray(value) ? value : []);
    return {
      customerId: typeof json.customerId === "string" ? json.customerId : null,
      watch: PropertyWatch.decode(json.watch),
      notifications: list(json.notifications).map(WatchNotification.decode).filter((n): n is WatchNotification => n !== null),
      unread: typeof json.unread === "number" && Number.isFinite(json.unread) ? json.unread : null,
      currentMatches: list(json.currentMatches).map(decodeMatch).filter((m): m is CurrentMatch => m !== null),
      scheduler: typeof json.scheduler === "string" ? json.scheduler : null,
    };
  },
} as const;

/** The backend's `listingKey` (lib/agent/research/listings.ts): the listing's own link, else its page, title, rooms
 *  and area. The price is not part of it, so a home whose rent dropped is still the same home. */
export const listingKey = (l: Listing): string =>
  l.url && l.url !== l.pageUrl ? l.url : `${l.pageUrl ?? ""}#${(l.title ?? "").toLowerCase()}|${l.rooms ?? "?"}|${l.areaM2 ?? "?"}`;

/** Whether two listings are the same home or offer. */
export function sameListing(a: Listing | null | undefined, b: Listing | null | undefined): boolean {
  return !!a && !!b && listingKey(a) === listingKey(b);
}
