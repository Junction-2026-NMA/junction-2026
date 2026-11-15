"use client";

import { useEffect, useState } from "react";
import DesktopPhone from "./DesktopPhone";
import "./gate.css";

export const QR_MESSAGE = "Scan this QR code with your phone to use the demo.";

/** Remembers, for the tab, that this computer chose to open the app here instead of on a phone. */
const UNLOCK_KEY = "sisu.gate.desktopUnlocked";

function readUnlocked(): boolean {
  try {
    return window.sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberUnlocked(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(UNLOCK_KEY, "1");
    else window.sessionStorage.removeItem(UNLOCK_KEY);
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

  useEffect(() => {
    // The unlock is kept for the tab, so a reload stays in the app.
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

  const openHere = () => {
    rememberUnlocked(true);
    setUnlocked(true);
  };

  if (unlocked) {
    return <DesktopPhone onLeave={() => { rememberUnlocked(false); setUnlocked(false); }} />;
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
        <div className="sisu-gate-open">
          <span className="sisu-gate-open-label">No phone at hand?</span>
          <button type="button" className="sisu-gate-open-button" onClick={openHere} data-testid="desktop.open">
            Use it on this computer
          </button>
        </div>
      </div>
    </main>
  );
}
