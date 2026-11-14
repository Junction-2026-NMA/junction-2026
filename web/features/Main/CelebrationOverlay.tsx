"use client";
// The full-screen Rive celebration (CelebrationOverlay in ios/Sisu/Features/Main/MainScreen.swift). It fires
// `fire` 150 ms after it is on screen and goes away on `done`, on a tap, or 4 s later if `done` never arrives.
// It fades in and out (easeInOut 0.25 s), over the tab bar and under sheets.
import { useEffect, useRef, useState } from "react";
import type { Celebration } from "@/web/app/AppTypes";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { riveAccessible } from "@/web/shared/SisuStyle";

const FIRE_AFTER_MS = 150;
const DISMISS_AFTER_MS = 4000;
const FADE_MS = 250;

export function CelebrationOverlay({ celebration, onDismiss }: { celebration: Celebration | null; onDismiss: () => void }) {
  // The last celebration stays on screen while it fades out.
  const [shown, setShown] = useState<Celebration | null>(celebration);
  if (celebration && celebration !== shown) setShown(celebration);
  const leaving = celebration === null && shown !== null;

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setShown(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  if (!shown) return null;
  return (
    <div className="sisu-celebration" data-leaving={leaving ? "true" : "false"} style={{ animationDuration: `${FADE_MS}ms` }}>
      <CelebrationContent key={`${shown.headline}|${shown.detail}`} celebration={shown} dismiss={leaving ? noop : onDismiss} />
    </div>
  );
}

const noop = () => undefined;

function CelebrationContent({ celebration, dismiss }: { celebration: Celebration; dismiss: () => void }) {
  const [fired, setFired] = useState(false);
  // The 4 s timer calls whatever dismiss is current by then.
  const latest = useRef(dismiss);
  useEffect(() => {
    latest.current = dismiss;
  });

  useEffect(() => {
    const fire = window.setTimeout(() => setFired(true), FIRE_AFTER_MS);
    const away = window.setTimeout(() => latest.current(), FIRE_AFTER_MS + DISMISS_AFTER_MS);
    return () => {
      window.clearTimeout(fire);
      window.clearTimeout(away);
    };
  }, []);

  const { headline, detail } = celebration;
  return (
    <div className="sisu-celebration-tap" onClick={dismiss} data-testid="celebration">
      <RiveComponent
        component="Celebration"
        values={RiveValues.celebration(headline, detail)}
        triggers={fired ? ["fire#1"] : []}
        onTrigger={(name) => {
          if (name === "done") dismiss();
        }}
        {...riveAccessible(`${headline} ${detail}`, { isButton: true, action: dismiss })}
      />
    </div>
  );
}
