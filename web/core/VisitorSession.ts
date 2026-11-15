// The visitor session (docs/FRONTEND_INTEGRATION_CONTRACT.md section 16). On a hosted server every visitor has
// their own approvals, memory and audit log, keyed by the `sisu_session` cookie or the `X-Sisu-Session` header.
// The cookie alone is enough on this same-origin page, but a page saved to the iPhone home screen gets its own
// cookie jar and can lose it, so the web app also keeps the server's session id and sends it as the header on
// every request: the session survives, and the same code works from another address.

const HEADER = "X-Sisu-Session";
const KEY = "sisu.session";

let memory = "";

function read(): string {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(value: string) {
  memory = value;
  try {
    globalThis.localStorage?.setItem(KEY, value);
  } catch {
    // Private mode or storage blocked: the in-memory copy still serves this page load.
  }
}

/** The session id the server gave this visitor, or "" before the first answer. */
export function visitorSession(): string {
  return read();
}

/** Forgets the session, so the next request starts a fresh visitor. */
export function forgetVisitorSession() {
  memory = "";
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

/** `fetch` with the visitor session: sends the stored id and keeps any new id the server hands out. */
export const sisuFetch: typeof fetch = async (input, init = {}) => {
  const session = read();
  const headers = new Headers(init.headers);
  if (session && !headers.has(HEADER)) headers.set(HEADER, session);
  const response = await fetch(input, { ...init, headers, credentials: "same-origin" });
  const given = response.headers.get(HEADER);
  if (given && given !== session) write(given);
  return response;
};
