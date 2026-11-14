"use client";
// Choosing a demo profile: the third screen of the first run, and the chooser that "Switch customer" opens.
// It carries the demo disclosure for the whole demo. Tapping a card is the action: the card turns S-Pankki green
// with a check, then the profile opens. Port of ios/Sisu/Features/Onboarding/ProfileStep.swift.
import { useEffect, useId, useRef, useState } from "react";
import type { DemoCustomer } from "@/web/core/Models";
import { OnboardingCopy, OnboardingProfiles } from "@/web/core/AppLogic/OnboardingCopy";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { Screen, ScreenStack } from "@/web/shared/Screen";
import { SisuButton, SisuCard } from "@/web/shared/SisuStyle";
import { useReducedMotion } from "@/web/theme/motion";
import { PressableCard } from "@/web/features/Picker/PressableCard";
import { CheckGlyph, InfoCircleGlyph } from "./Glyphs";
import { haptic } from "./OnboardingMotion";
import "./profile.css";

export type ProfileStepMode = "onboarding" | "chooser";

export function ProfileStep({ mode, choose }: { mode: ProfileStepMode; choose: (customer: DemoCustomer) => void }) {
  const model = useAppModel();
  const reduceMotion = useReducedMotion();
  const customersState = useAppSelector((s) => s.customersState);
  const customers = useAppSelector((s) => s.customers);
  const [selected, setSelected] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  // .sensoryFeedback(.selection, trigger: selected)
  useEffect(() => { if (selected !== null) haptic(8); }, [selected]);

  const pick = (customer: DemoCustomer) => {
    if (selected !== null) return;
    setSelected(customer.customerId);
    // Long enough to see the card turn green; the profile's data starts loading right after.
    const pause = reduceMotion ? 0 : Math.round(260 * model.launch.motionScale);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      choose(customer);
    }, pause);
  };

  return (
    <Screen tabBar={false} safeTop={mode === "chooser"} className="sisu-profile-screen"
      testId={mode === "chooser" ? "screen.picker" : "onboarding.profile"}>
      <ScreenStack className="sisu-profile-stack">
        <div className="sisu-profile-heading" data-mode={mode}>
          <h1 className="sisu-profile-title">{OnboardingCopy.profileTitle}</h1>
          <p className="sisu-profile-body">{OnboardingCopy.profileBody}</p>
        </div>

        <DemoDisclosure />

        {customersState.kind === "failed" ? (
          <SisuCard>
            <p className="sisu-profile-failed">{customersState.message}</p>
            <SisuButton label="Try again" style="secondary" action={() => void model.retry()} />
          </SisuCard>
        ) : customersState.kind === "loaded" ? (
          OnboardingProfiles.sorted(customers).map((customer) => (
            <ProfileCard key={customer.customerId} customer={customer}
              selected={selected === customer.customerId}
              dimmed={selected !== null && selected !== customer.customerId}
              action={() => pick(customer)} />
          ))
        ) : (
          <div className="sisu-profile-loading" role="status" aria-label="Loading the profiles">
            <span className="sisu-profile-spinner" aria-hidden="true" />
          </div>
        )}
      </ScreenStack>
    </Screen>
  );
}

/** "This is a demo": the one place the demo is disclosed. */
export function DemoDisclosure() {
  return (
    <div className="sisu-disclosure" role="group" aria-label={`${OnboardingCopy.disclosureTitle}. ${OnboardingCopy.disclosureBody}`}>
      <span className="sisu-disclosure-icon"><InfoCircleGlyph size={20} /></span>
      <div className="sisu-disclosure-text" aria-hidden="true">
        <p className="sisu-disclosure-title">{OnboardingCopy.disclosureTitle}</p>
        <p className="sisu-disclosure-body">{OnboardingCopy.disclosureBody}</p>
      </div>
    </div>
  );
}

function ProfileCard({ customer, selected, dimmed, action }: {
  customer: DemoCustomer;
  selected: boolean;
  dimmed: boolean;
  action: () => void;
}) {
  const hintId = useId();
  const initial = Array.from(customer.displayName)[0] ?? "";
  return (
    <div className="sisu-profile-card-wrap" data-dimmed={dimmed ? "true" : "false"}>
      <PressableCard onPress={action} ariaLabel={OnboardingProfiles.accessibilityLabel(customer)}
        ariaDescribedBy={hintId} ariaPressed={selected} className="sisu-profile-card">
        <span className="sisu-profile-card-row" data-selected={selected ? "true" : "false"}>
          <span className="sisu-profile-avatar">{initial}</span>
          <span className="sisu-profile-lines">
            <span className="sisu-profile-name">{customer.displayName}</span>
            <span className="sisu-profile-subtitle">{OnboardingProfiles.subtitle(customer)}</span>
            <span className="sisu-profile-pitch">{OnboardingProfiles.pitch(customer.customerId)}</span>
          </span>
          <span className="sisu-profile-check">
            {selected ? <span className="sisu-profile-check-mark"><span className="sisu-profile-check-glyph"><CheckGlyph size={13} /></span></span> : null}
          </span>
        </span>
      </PressableCard>
      <span id={hintId} className="sisu-visually-hidden">Opens this profile&apos;s money</span>
    </div>
  );
}
