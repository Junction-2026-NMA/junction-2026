"use client";

import { useEffect, useState } from "react";
import "./gate.css";

export const QR_MESSAGE = "Scan this QR code with your phone to use the demo.";

type QrLib = typeof import("qrcode");

type QrState = { kind: "loading" } | { kind: "ready"; svg: string; url: string } | { kind: "failed"; url: string };

/** The computer view: one sentence and a QR code of this origin's /app. Nothing else. */
export default function DesktopQr() {
  const [qr, setQr] = useState<QrState>({ kind: "loading" });

  useEffect(() => {
    // The public address, not this tab's: a deployment's own *.vercel.app address can sit behind a Vercel
    // sign-in, and a phone sent there never reaches the demo. NEXT_PUBLIC_SISU_PUBLIC_URL is set at build time.
    const base = (process.env.NEXT_PUBLIC_SISU_PUBLIC_URL || window.location.origin).replace(/\/+$/, "");
    const url = `${base}/app`;
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
  }, []);

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
      </div>
    </main>
  );
}
