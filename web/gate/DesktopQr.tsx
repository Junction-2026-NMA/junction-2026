"use client";

import { useEffect, useState, type FormEvent } from "react";
import DesktopPhone from "./DesktopPhone";
import "./gate.css";

export const QR_MESSAGE = "Scan this QR code with your phone to use the demo.";

/** The demo code that opens the app on a computer, in an iPhone-sized frame. A demo convenience, not security. */
const DEMO_CODE = "1234";
const UNLOCK_KEY = "sisu.gate.desktopUnlocked";

// Kept in localStorage, so the code is asked for once per browser: new tabs, reloads and restarts open the app.
// An unlock kept for one tab only (sessionStorage, before 15 Nov) still counts and is moved over.
function readUnlocked(): boolean {
  try {
    if (window.localStorage.getItem(UNLOCK_KEY) === "1") return true;
    if (window.sessionStorage.getItem(UNLOCK_KEY) === "1") {
      window.localStorage.setItem(UNLOCK_KEY, "1");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function rememberUnlocked(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(UNLOCK_KEY, "1");
    else window.localStorage.removeItem(UNLOCK_KEY);
    window.sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    // Private mode: it lasts until the page reloads.
  }
}

type QrLib = typeof import("qrcode");

/** The QR code the server drew into the page. Either part may be missing. */
export interface ServerQr {
  url: string | null;
  svg: string | null;
}

type QrState = { kind: "loading" } | { kind: "ready"; svg: string; url: string } | { kind: "failed"; url: string };

/** The demo's public address (never a sign-in-protected deployment URL), as the browser sees it. */
function browserUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SISU_PUBLIC_URL || window.location.origin).replace(/\/+$/, "");
  return `${base}/app`;
}

/**
 * The computer view: one sentence and a QR code of the demo's /app. Nothing else.
 * The server normally draws the code into the HTML; the browser draws it only when the server could not.
 */
export default function DesktopQr({ serverQr }: { serverQr?: ServerQr }) {
  const fromServer = serverQr?.svg && serverQr.url ? { kind: "ready" as const, svg: serverQr.svg, url: serverQr.url } : null;
  const [qr, setQr] = useState<QrState>(fromServer ?? { kind: "loading" });
  const hasServerQr = fromServer !== null;
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    // The unlock is kept in this browser, so a reload or a new tab stays in the app.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (readUnlocked()) setUnlocked(true);
  }, []);

  useEffect(() => {
    if (hasServerQr) return;
    const url = browserUrl();
    let cancelled = false;
    import("qrcode")
      .then((mod) => {
        // qrcode is CommonJS: prefer module.exports (default) over the bundler's namespace copy.
        const QRCode: QrLib = (mod as unknown as { default?: QrLib }).default ?? mod;
        return QRCode.toString(url, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 0,
          color: { dark: "#004628ff", light: "#ffffffff" },
        });
      })
      .then((svg) => {
        if (!cancelled) setQr({ kind: "ready", svg, url });
      })
      .catch(() => {
        if (!cancelled) setQr({ kind: "failed", url });
      });
    return () => {
      cancelled = true;
    };
  }, [hasServerQr]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim() === DEMO_CODE) {
      rememberUnlocked(true);
      setUnlocked(true);
    } else {
      setWrong(true);
      setCode("");
    }
  };

  if (unlocked) {
    return <DesktopPhone onLeave={() => { rememberUnlocked(false); setUnlocked(false); setCode(""); setWrong(false); }} />;
  }

  return (
    <main className="sisu-gate">
      <div className="sisu-gate-qr">
        <p className="sisu-gate-qr-message">{QR_MESSAGE}</p>
        {qr.kind === "ready" ? (
          <div
            className="sisu-gate-qr-code"
            role="img"
            aria-label={`QR code for ${qr.url}`}
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
        ) : (
          <div className="sisu-gate-qr-code" aria-hidden="true" />
        )}
        {qr.kind === "failed" ? (
          <p className="sisu-gate-qr-error">The QR code could not be drawn. Open {qr.url} on your phone.</p>
        ) : null}
        <form className="sisu-gate-code" onSubmit={submit} data-testid="desktop.code">
          <label className="sisu-gate-code-label" htmlFor="sisu-demo-code">Or try it on this computer with the demo code</label>
          <div className="sisu-gate-code-row">
            <input
              id="sisu-demo-code"
              className="sisu-gate-code-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              placeholder="Code"
              value={code}
              aria-invalid={wrong || undefined}
              aria-describedby={wrong ? "sisu-demo-code-error" : undefined}
              onChange={(event) => { setCode(event.target.value); setWrong(false); }}
            />
            <button type="submit" className="sisu-gate-code-button" disabled={code.trim() === ""}>Open</button>
          </div>
          {wrong ? <p id="sisu-demo-code-error" className="sisu-gate-code-error" role="alert">That code is not right. Try again.</p> : null}
        </form>
      </div>
    </main>
  );
}
