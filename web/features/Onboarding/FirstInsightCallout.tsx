"use client";
// The first useful moment: on the first visit to Today after the first run, Liito points at the flagged bill and
// links to the transactions behind it. Spotlit for about a second on arrival (a green ring that grows out and
// fades once, and a light haptic), then it stays until the user taps it away. TodayScreen places it with one line
// at the top of its content (`<FirstInsightCallout />`, no props, like the Swift view); it draws nothing once
// dismissed. Text and figures come from web/core's FirstInsightPresenter.
// Port of ios/Sisu/Features/Onboarding/FirstInsightCallout.swift.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FirstInsightPresenter, type FirstInsightState } from "@/web/core/AppLogic/OnboardingCopy";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { LiitoView, SisuIconButton, SisuMotion } from "@/web/shared/SisuStyle";
import { prefersReducedMotion, useReducedMotion } from "@/web/theme/motion";
import { SisuSprings } from "@/web/theme/theme";
import { ChevronRightGlyph } from "./Glyphs";
import { OnboardingMotion, haptic } from "./OnboardingMotion";
import "./first-insight.css";

export function FirstInsightCallout() {
  const model = useAppModel();
  const reduceMotion = useReducedMotion();
  const pending = useAppSelector((s) => s.firstInsightPending);
  const overview = useAppSelector((s) => s.overview);
  const confirmedName = useAppSelector((s) => (s.flaggedBill ? model.confirmedName(s.flaggedBill) : null));
  const state = useMemo(
    () => (pending && overview ? FirstInsightPresenter.state(overview, confirmedName) : null),
    [pending, overview, confirmedName],
  );

  // withAnimation(SisuMotion.state) { dismissFirstInsight() }: the card fades and shrinks to 96 % (anchored at the
  // top) while the space closes. Any other way it goes is instant, as in SwiftUI.
  const animatedDismiss = useRef(false);
  const last = useRef<FirstInsightState | null>(state);
  const [leaving, setLeaving] = useState<FirstInsightState | null>(null);
  useLayoutEffect(() => {
    const previous = last.current;
    last.current = state;
    if (state !== null || previous === null || !animatedDismiss.current) return;
    animatedDismiss.current = false;
    setLeaving(previous);
  }, [state]);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), SisuSprings.state.durationMs);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const shown = state ?? leaving;
  if (!shown) return null;
  const dismiss = () => {
    animatedDismiss.current = SisuMotion.state(reduceMotion) !== null;
    model.dismissFirstInsight();
  };
  return <FirstInsightCard state={shown} leaving={state === null} dismiss={dismiss} />;
}

export default FirstInsightCallout;

type Spotlight = "off" | "on" | "fading";

function FirstInsightCard({ state, leaving, dismiss }: { state: FirstInsightState; leaving: boolean; dismiss: () => void }) {
  const model = useAppModel();
  const hintId = useId();
  const scale = model.launch.motionScale;
  const [reduceMotion] = useState(prefersReducedMotion);
  const [arrived, setArrived] = useState(reduceMotion);
  const [spotlight, setSpotlight] = useState<Spotlight>("off");
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    haptic(10);
    if (reduceMotion) return;
    // Comes in with Today itself (no wait, so its space is never empty), then the ring fades.
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => { setArrived(true); setSpotlight("on"); });
    });
    const timer = window.setTimeout(() => setSpotlight("fading"), Math.round(1000 * scale));
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [reduceMotion, scale]);

  // Measure once the dismissal starts, so the wrapper can close its height smoothly.
  useLayoutEffect(() => {
    if (leaving && box.current) setHeight(box.current.offsetHeight);
  }, [leaving]);

  const arrival = OnboardingMotion.spring(reduceMotion, 0.45 * scale, 0.78);
  const motion: CSSProperties = {
    opacity: arrived ? 1 : 0,
    transform: arrived ? "none" : "translateY(16px)",
    transition: OnboardingMotion.transition(arrival, ["opacity", "transform"]),
  };
  const ring: CSSProperties = {
    opacity: spotlight === "on" ? 1 : 0,
    transition: spotlight === "fading"
      ? `opacity ${Math.round(600 * scale)}ms var(--sisu-motion-ease-out)`
      : OnboardingMotion.transition(arrival, ["opacity"]),
  };

  return (
    <div className="sisu-first-insight-slot" data-leaving={leaving ? "true" : "false"}
      style={leaving && height !== null ? ({ ["--sisu-first-insight-height" as string]: `${height}px` } as CSSProperties) : undefined}>
      <div ref={box} className="sisu-first-insight-box" style={motion} data-testid="today.firstInsight">
        <div className="sisu-first-insight-ring" style={ring} aria-hidden="true" />
        <div className="sisu-first-insight-card">
          <div className="sisu-first-insight-top">
            <LiitoView mood="found" label="Liito points at what Sisu found" className="sisu-first-insight-liito"
              style={{ width: 56, height: 56 }} />
            <span className="sisu-first-insight-eyebrow">{state.eyebrow}</span>
            <span className="sisu-first-insight-fill" />
            <SisuIconButton icon="close" style="plain" label={`${state.dismissLabel}, hide this`} action={dismiss}
              className="sisu-first-insight-close" />
          </div>
          <h2 className="sisu-first-insight-headline">{state.headline}</h2>
          <p className="sisu-first-insight-detail">{state.detail}</p>
          <div className="sisu-first-insight-divider" aria-hidden="true" />
          <button type="button" className="sisu-first-insight-link" aria-label={state.linkLabel} aria-describedby={hintId}
            onClick={() => model.showEvidence(state.evidenceTitle, state.evidence)}>
            <span className="sisu-first-insight-source">{state.source}</span>
            <span className="sisu-first-insight-see">{state.seeLabel}</span>
            <span className="sisu-first-insight-chevron"><ChevronRightGlyph size={12} /></span>
          </button>
          <span id={hintId} className="sisu-visually-hidden">Shows the transactions behind this</span>
        </div>
      </div>
    </div>
  );
}
