"use client";
// The first run's top bar: back, the Rive progress bar, skip. Hidden (faded out) on the sorting moment.
// Part of the port of ios/Sisu/Features/Onboarding/OnboardingView.swift (`topBar`).
import { useId, type CSSProperties, type ReactNode } from "react";
import { OnboardingFlow, OnboardingStep } from "@/web/core/AppLogic/Onboarding";
import { OnboardingCopy } from "@/web/core/AppLogic/OnboardingCopy";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { SisuIconButton, riveAccessible } from "@/web/shared/SisuStyle";
import { OnboardingMotion, type MotionTiming } from "./OnboardingMotion";

export function OnboardingTopBar({ flow, shownStep, page, onBack, onSkip }: {
  flow: OnboardingFlow;
  shownStep: OnboardingStep;
  page: MotionTiming | null;
  onBack: () => void;
  onSkip: () => void;
}) {
  const hintId = useId();
  const showBack = OnboardingFlow.canGoBack(flow) || (shownStep === "profile" && flow.step === "reading");
  const showSkip = OnboardingFlow.canSkip(flow);
  const fade = OnboardingMotion.transition(page, ["opacity"]);
  const barStyle: CSSProperties = { opacity: shownStep === "reading" ? 0 : 1, transition: fade };

  return (
    <div className="sisu-onb-topbar" style={barStyle}>
      <Fading shown={showBack} transition={fade} className="sisu-onb-topbar-back">
        <SisuIconButton icon="back" style="plain" label={OnboardingCopy.back} action={onBack} />
      </Fading>

      <RiveComponent component="ProgressBar" values={RiveValues.progress(OnboardingFlow.progress(flow))}
        className="sisu-onb-topbar-progress"
        {...riveAccessible("First run", { value: `Step ${OnboardingStep.number(flow.step)} of ${OnboardingFlow.stepCount}` })} />

      <Fading shown={showSkip} transition={fade} className="sisu-onb-topbar-skip">
        <button type="button" className="sisu-onb-skip" onClick={onSkip} aria-describedby={hintId}>
          {OnboardingCopy.skip}
        </button>
        <span id={hintId} className="sisu-visually-hidden">Goes straight to choosing a profile</span>
      </Fading>
    </div>
  );
}

/** `.transition(.opacity)` inside a fixed frame: stays laid out, fades, and is out of reach while hidden. */
function Fading({ shown, transition, className, children }: {
  shown: boolean;
  transition: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={{ opacity: shown ? 1 : 0, transition, pointerEvents: shown ? undefined : "none" }}
      aria-hidden={shown ? undefined : true}
      inert={shown ? undefined : true}
    >
      {children}
    </div>
  );
}
