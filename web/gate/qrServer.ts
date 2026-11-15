// Server only: draws the desktop QR code into the page's HTML, so it shows without waiting for (or depending
// on) any script in the browser.
import QRCode from "qrcode";

export const QR_OPTIONS = {
  type: "svg",
  errorCorrectionLevel: "M",
  margin: 0,
  color: { dark: "#004628ff", light: "#ffffffff" },
} as const;

/**
 * The public address of the demo: NEXT_PUBLIC_SISU_PUBLIC_URL when set (a deployment's own *.vercel.app address
 * can sit behind a Vercel sign-in), else the address this request came in on.
 */
export function publicDemoUrl(host: string | null, proto: string | null): string | null {
  const configured = process.env.NEXT_PUBLIC_SISU_PUBLIC_URL?.replace(/\/+$/, "");
  if (configured) return `${configured}/app`;
  if (!host) return null;
  return `${proto ?? "https"}://${host}/app`;
}

/** The QR code as SVG markup, or null when it cannot be drawn (the browser then draws it). */
export async function qrSvg(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    return await QRCode.toString(url, QR_OPTIONS);
  } catch {
    return null;
  }
}
