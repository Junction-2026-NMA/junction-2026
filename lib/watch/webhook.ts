// Context.dev webhooks: each project monitor tells Sisu when it ran or saw a change, so a finding is made (and
// pushed to the phone) while the app is closed, without waiting for the daily cron.
// - The webhook address carries `ref`: the session, customer and watch, encrypted with AES-256-GCM under a key
//   derived from SISU_WEBHOOK_KEY. Context.dev never sees a session id (a session id is a capability).
//   Without SISU_WEBHOOK_KEY (or a public origin) no webhook is set and the copy says monitoring is polled instead.
// - A delivery is signed: X-Context-Signature "t=<unix>,v1=<hex>", v1 = HMAC-SHA256(monitor secret, `${t}.${raw body}`),
//   checked on the raw body within 5 minutes. X-Context-Id is the same on every retry: it is the dedupe key.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SIGNATURE_TOLERANCE_S = 300;
export type WebhookRef = { sessionId: string; customerId: string; watchId: string };

const secretKey = (): Buffer | null => {
  const secret = process.env.SISU_WEBHOOK_KEY?.trim();
  return secret ? createHash("sha256").update(`sisu-webhook-ref|${secret}`).digest() : null;
};

export const webhooksConfigured = (): boolean => !!secretKey();

export function encryptRef(ref: WebhookRef): string | null {
  const key = secretKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ s: ref.sessionId, c: ref.customerId, w: ref.watchId }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

// Null for anything that was not made by encryptRef with this server's key (tampered, truncated, other key).
export function decryptRef(token: string | null | undefined): WebhookRef | null {
  const key = secretKey();
  if (!key || !token || token.length > 600) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    const o = JSON.parse(text) as { s?: unknown; c?: unknown; w?: unknown };
    return typeof o.s === "string" && typeof o.c === "string" && typeof o.w === "string" ? { sessionId: o.s, customerId: o.c, watchId: o.w } : null;
  } catch {
    return null;
  }
}

export const signPayload = (secret: string, timestamp: number, rawBody: string): string => createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

// True when the header was made with one of the secrets over this exact body, less than 5 minutes ago.
export function verifySignature(header: string | null, rawBody: string, secrets: string[], now: Date = new Date()): boolean {
  if (!header || !secrets.length) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const given = parts.v1 ?? "";
  if (!Number.isFinite(t) || !/^[0-9a-f]{64}$/i.test(given)) return false;
  if (Math.abs(now.getTime() / 1000 - t) > SIGNATURE_TOLERANCE_S) return false;
  const givenBytes = Buffer.from(given, "hex");
  return secrets.some((secret) => timingSafeEqual(Buffer.from(signPayload(secret, t, rawBody), "hex"), givenBytes));
}

// Where Context.dev can reach this backend: SISU_PUBLIC_API_ORIGIN, else Vercel's production address, else the
// address the request came in on. Never a local address (Context.dev could not reach it).
export function publicOrigin(requestUrl?: string): string | null {
  const configured = process.env.SISU_PUBLIC_API_ORIGIN?.trim().replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidate = configured || (vercel ? `https://${vercel}` : requestUrl && URL.canParse(requestUrl) ? new URL(requestUrl).origin : "");
  if (!candidate || !URL.canParse(candidate)) return null;
  const url = new URL(candidate);
  if (url.protocol !== "https:" || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname)) return null;
  return url.origin;
}

export function webhookUrl(origin: string | null, ref: WebhookRef): string | null {
  const token = encryptRef(ref);
  return origin && token ? `${origin}/api/watch/webhook?ref=${token}` : null;
}

export type WebhookEvent = { event: string; id: string; monitorId: string | null; change: { title: string; summary: string; detectedAt: string } | null };

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

export function parseEvent(rawBody: string, headerId: string | null, headerEvent: string | null): WebhookEvent | null {
  try {
    const body = JSON.parse(rawBody) as { event?: unknown; id?: unknown; created_at?: unknown; data?: { change?: Record<string, unknown>; run?: Record<string, unknown>; monitor_id?: unknown } };
    const id = headerId ?? str(body.id);
    const event = headerEvent ?? str(body.event);
    if (!id || !event) return null;
    const change = body.data?.change ?? null;
    const run = body.data?.run ?? null;
    const monitorId = str(change?.monitor_id) ?? str(run?.monitor_id) ?? str(body.data?.monitor_id);
    return {
      event,
      id,
      monitorId,
      change: change ? { title: (str(change.title) ?? "Change detected").slice(0, 200), summary: (str(change.summary) ?? "").slice(0, 600), detectedAt: str(change.detected_at) ?? str(body.created_at) ?? new Date().toISOString() } : null,
    };
  } catch {
    return null;
  }
}
