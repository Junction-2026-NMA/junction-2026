"use client";
// The first run's own screens: 1. Welcome, 2. the three baskets and what Sisu does, 4. the sorting moment.
// (3, the profile choice, is ProfileStep.tsx.) Port of the private steps in ios/Sisu/Features/Onboarding/OnboardingView.swift.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { BasketKind } from "@/web/core/Presentation";
import { RiveBindings } from "@/web/core/RiveContract";
import { OnboardingCopy, OnboardingReading, type OnboardingBasketRow } from "@/web/core/AppLogic/OnboardingCopy";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { LiitoView, SisuButton, SisuCard } from "@/web/shared/SisuStyle";
import { prefersReducedMotion } from "@/web/theme/motion";
import { BasketGlyph, CheckGlyph } from "./Glyphs";
import { OnboardingMotion, type MotionTiming } from "./OnboardingMotion";

// MARK: 1. Welcome

export function WelcomeStep({ next }: { next: () => void }) {
  return (
    <div className="sisu-onb-step sisu-onb-welcome" data-testid="onboarding.welcome">
      <div className="sisu-onb-spacer" aria-hidden="true" />
      <div className="sisu-onb-liito">
        <LiitoView mood="cheering" label="Liito the flying squirrel waves hello" style={{ width: 240, height: 240 }} />
      </div>
      <p className="sisu-onb-wordmark" aria-label="Sisu">sisu</p>
      <h1 className="sisu-onb-h1">{OnboardingCopy.welcomeTitle}</h1>
      <p className="sisu-onb-body-large">{OnboardingCopy.welcomeBody}</p>
      <div className="sisu-onb-spacer sisu-onb-spacer-section" aria-hidden="true" />
      <SisuButton label={OnboardingCopy.welcomeButton} action={next} />
    </div>
  );
}

// MARK: 2. Three baskets, then what Sisu does

export function PromiseStep({ next }: { next: () => void }) {
  const model = useAppModel();
  const total = OnboardingCopy.promiseBaskets.length + 1;
  const [reduceMotion] = useState(prefersReducedMotion);
  /** How many rows have arrived: the baskets, then the "Then Sisu" block. */
  const [shown, setShown] = useState(() => (reduceMotion ? total : 0));
  const scale = model.launch.motionScale;

  useEffect(() => {
    if (reduceMotion) return;
    // The rows come in one at a time once the page has slid in: 220 ms, then one every 140 ms.
    const timers = Array.from({ length: total }, (_, index) =>
      window.setTimeout(() => setShown(index + 1), Math.round(220 * scale + index * 140 * scale)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduceMotion, scale, total]);

  const arrival = OnboardingMotion.arrival(reduceMotion, scale, 0);
  return (
    <div className="sisu-onb-step sisu-onb-promise" data-testid="onboarding.promise">
      <div className="sisu-onb-promise-scroll">
        <div className="sisu-onb-promise-content">
          <h1 className="sisu-onb-h1 sisu-onb-promise-title">{OnboardingCopy.promiseTitle}</h1>
          <SisuCard>
            {OnboardingCopy.promiseBaskets.map((row, index) => (
              <BasketRowGroup key={row.id} first={index === 0}>
                <Arriving arrived={index < shown} timing={arrival}><BasketRow row={row} /></Arriving>
              </BasketRowGroup>
            ))}
          </SisuCard>
          <Arriving arrived={shown > OnboardingCopy.promiseBaskets.length} timing={arrival} className="sisu-onb-then">
            <h2 className="sisu-onb-h3">{OnboardingCopy.promiseThenTitle}</h2>
            <ul className="sisu-onb-then-list">
              {OnboardingCopy.promiseThen.map((line) => (
                <li key={line} className="sisu-onb-then-line">
                  <span className="sisu-onb-then-check" aria-hidden="true"><CheckGlyph size={11} /></span>
                  <span className="sisu-onb-body-large sisu-onb-text">{line}</span>
                </li>
              ))}
            </ul>
          </Arriving>
        </div>
      </div>
      <div className="sisu-onb-button-row">
        <SisuButton label={OnboardingCopy.promiseButton} action={next} />
      </div>
    </div>
  );
}

function BasketRowGroup({ first, children }: { first: boolean; children: ReactNode }) {
  return (
    <>
      {first ? null : <div className="sisu-onb-divider" aria-hidden="true" />}
      {children}
    </>
  );
}

/** The basket's green, as on the Rive chip (tokens.css: dark to light). */
const basketGreen = {
  fixed: "var(--sisu-color-basket-fixed)",
  curveballs: "var(--sisu-color-basket-curveballs)",
  leaks: "var(--sisu-color-basket-leaks)",
} as const;

function BasketRow({ row }: { row: OnboardingBasketRow }) {
  return (
    <div className="sisu-onb-basket-row">
      {/* The Rive BasketChip shrinks its text to a fixed width, so the three names came out at three sizes; this
          chip keeps one text size and grows (or wraps) with the name. */}
      <span className="sisu-onb-chip" role="img" aria-label={`${BasketKind.label(row.kind, "en")} basket`}>
        <span className="sisu-onb-chip-icon" style={{ color: basketGreen[row.kind] }}><BasketGlyph kind={row.kind} /></span>
        <span aria-hidden="true">{BasketKind.label(row.kind, "en")}</span>
      </span>
      <p className="sisu-onb-h3">{row.examples}</p>
      <p className="sisu-onb-label-muted">{row.meaning}</p>
    </div>
  );
}

/** Hidden and 12 px lower until it has arrived. */
function Arriving({ arrived, timing, className, children }: {
  arrived: boolean;
  timing: MotionTiming | null;
  className?: string;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    opacity: arrived ? 1 : 0,
    transform: arrived ? "none" : "translateY(12px)",
    transition: OnboardingMotion.transition(timing, ["opacity", "transform"]),
  };
  return <div className={className} style={style}>{children}</div>;
}

// MARK: 4. The sorting moment

/** Shown while a slow load is running (OnboardingView finishes the flow the moment the overview is loaded), and
 *  with a way back if the profile could not be read. */
export function ReadingStep() {
  const model = useAppModel();
  const overviewState = useAppSelector((s) => s.overviewState);
  const name = useAppSelector((s) => s.customer?.displayName ?? "this profile");
  return (
    <div className="sisu-onb-step sisu-onb-reading" data-testid="onboarding.reading">
      <div className="sisu-onb-spacer" aria-hidden="true" />
      {overviewState.kind === "failed" ? (
        <>
          <p className="sisu-onb-body-large sisu-onb-text sisu-onb-center">{overviewState.message}</p>
          <div className="sisu-onb-spacer" aria-hidden="true" />
          <SisuButton label={OnboardingReading.failedButton} style="secondary" action={() => model.onboardingReadingFailed()} />
        </>
      ) : (
        <>
          <LiitoView mood="thinking" label="Liito is reading" style={{ width: 200, height: 200 }} />
          <h1 className="sisu-onb-h2 sisu-onb-center">{OnboardingReading.loadingTitle(name)}</h1>
          <p className="sisu-onb-body-muted sisu-onb-center">{OnboardingReading.loadingDetail}</p>
          <div aria-hidden="true">
            <RiveComponent component="TypingDots" values={RiveBindings.typingDots(true)} />
          </div>
          <div className="sisu-onb-spacer" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
