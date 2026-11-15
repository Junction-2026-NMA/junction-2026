"use client";
// The root: the first-run onboarding until it is complete, then the profile chooser while no customer is chosen
// (after "Switch customer"), then the main screen with its tab bar. Port of ios/Sisu/App/RootView.swift.
//
// Transitions as on iOS, with SisuMotion.state (spring 0.35/0.72): the onboarding fades in, and leaves with a
// slower 0.45 s ease-out fade so the hand-over never shows an empty screen; the chooser fades; the main screen
// fades in and grows from 98 % on top (z-index 1). With Reduce Motion the switch is instant (SwiftUI animation nil).
// The very first screen appears without a transition, like a SwiftUI view on launch.
//
// While a returning person's profile is chosen again on launch (stored, or `customer=`) and its overview and coach
// session load, the route is "restoring": only the app background, never the profile chooser (15 Nov QA: every
// launch flashed "Pick someone to be today" under Sisu for about 200 ms). The screen after it appears at once,
// without a cross-fade.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import OnboardingView from "@/web/features/Onboarding/OnboardingView";
import PickerScreen from "@/web/features/Picker/PickerScreen";
import MainScreen from "@/web/features/Main/MainScreen";
import { useAppSelector } from "./AppProvider";
import "./root.css";

type Route = "onboarding" | "restoring" | "chooser" | "main";

interface Layer {
  readonly id: number;
  readonly route: Route;
  /** "shown" for the first screen; "entering" and "leaving" play their transition. */
  readonly phase: "shown" | "entering" | "leaving";
}

/** The longest exit (0.45 s) plus room: a leaving layer is removed by then even if no animationend arrives. */
const LEAVE_FALLBACK_MS = 700;

function screen(route: Route): ReactNode {
  switch (route) {
    case "onboarding": return <OnboardingView />;
    case "restoring": return null;
    case "chooser": return <PickerScreen />;
    case "main": return <MainScreen />;
  }
}

export default function RootView() {
  const route = useAppSelector((s): Route =>
    (s.onboardingActive ? "onboarding" : s.restoringCustomer ? "restoring" : s.customer !== null ? "main" : "chooser"));
  const reduceMotion = useReducedMotion();
  const [layers, setLayers] = useState<readonly Layer[]>(() => [{ id: 0, route, phase: "shown" }]);
  const nextId = useRef(1);

  useEffect(() => {
    setLayers((current) => {
      const top = current[current.length - 1];
      if (top && top.route === route && top.phase !== "leaving") return current;
      const id = nextId.current;
      nextId.current += 1;
      // Nothing to cross-fade from while restoring: the next screen is simply there.
      if (reduceMotion || current.every((layer) => layer.route === "restoring")) return [{ id, route, phase: "shown" }];
      const kept = current.filter((layer) => layer.phase !== "leaving" || layer.route !== route);
      return [...kept.map((layer): Layer => ({ ...layer, phase: "leaving" })), { id, route, phase: "entering" }];
    });
  }, [route, reduceMotion]);

  const leavingIds = layers.filter((l) => l.phase === "leaving").map((l) => l.id).join(",");
  useEffect(() => {
    if (leavingIds === "") return;
    const timer = window.setTimeout(() => setLayers((current) => current.filter((l) => l.phase !== "leaving")), LEAVE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [leavingIds]);

  const settle = (layer: Layer) => {
    setLayers((current) =>
      layer.phase === "leaving"
        ? current.filter((l) => l.id !== layer.id)
        : current.map((l) => (l.id === layer.id && l.phase === "entering" ? { ...l, phase: "shown" } : l)),
    );
  };

  return (
    <div className="sisu-rootview">
      {layers.map((layer) => (
        <div
          key={layer.id}
          className="sisu-route"
          data-route={layer.route}
          data-phase={layer.phase}
          aria-hidden={layer.phase === "leaving" || undefined}
          inert={layer.phase === "leaving" || undefined}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) settle(layer);
          }}
        >
          {screen(layer.route)}
        </div>
      ))}
    </div>
  );
}
