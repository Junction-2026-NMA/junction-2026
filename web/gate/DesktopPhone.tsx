"use client";
// The demo on a computer, after the demo code: the app inside an iPhone-sized frame. The app runs in an iframe
// whose viewport is exactly an iPhone's screen (402 x 874 points, iPhone 16 Pro), so every fixed layer, sheet,
// tab bar and media query behaves as on the phone. The frame scales down, never up, to fit a small window.
import { useEffect, useState } from "react";
import "./gate.css";

export const PHONE_WIDTH = 402;
export const PHONE_HEIGHT = 874;
const BEZEL = 14;
const MARGIN = 24;

/** The address the frame opens: the app itself, past the gate. */
function appUrl(): string {
  const query = new URLSearchParams(window.location.search);
  query.delete("device");
  query.set("standalone", "1");
  return `/app?${query.toString()}`;
}

function fitScale(): number {
  const width = PHONE_WIDTH + BEZEL * 2;
  const height = PHONE_HEIGHT + BEZEL * 2;
  const room = { width: window.innerWidth - MARGIN * 2, height: window.innerHeight - MARGIN * 2 - 40 };
  return Math.min(1, room.width / width, room.height / height);
}

export default function DesktopPhone({ onLeave }: { onLeave: () => void }) {
  const [scale, setScale] = useState(1);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    // The window's size and address are only known in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(appUrl());
    const update = () => setScale(fitScale());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const outerWidth = (PHONE_WIDTH + BEZEL * 2) * scale;
  const outerHeight = (PHONE_HEIGHT + BEZEL * 2) * scale;

  return (
    <main className="sisu-gate sisu-gate-desk">
      <div className="sisu-gate-desk-stage" style={{ width: outerWidth, height: outerHeight }}>
        <div className="sisu-gate-desk-phone" style={{ transform: `scale(${scale})`, padding: BEZEL }} data-testid="desktop.phone">
          {src ? (
            <iframe
              className="sisu-gate-desk-screen"
              src={src}
              title="Sisu demo"
              width={PHONE_WIDTH}
              height={PHONE_HEIGHT}
              allow="microphone; autoplay"
            />
          ) : null}
        </div>
      </div>
      <button type="button" className="sisu-gate-link" onClick={onLeave}>Back to the QR code</button>
    </main>
  );
}
