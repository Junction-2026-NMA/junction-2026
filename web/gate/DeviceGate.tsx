"use client";

import { useEffect, useState, type ReactNode } from "react";
import DesktopQr from "./DesktopQr";
import InstallSteps from "./InstallSteps";
import { LaunchScreen } from "./AppLoader";
import { decideView, type DeviceKind, type GateOverrides, type InstallPlatform } from "./detect";
import {
  detectClientKind,
  detectClientPlatform,
  detectStandalone,
  readContinuedInBrowser,
  rememberContinuedInBrowser,
} from "./clientDetect";

interface DeviceGateProps {
  /** The server's first guess from the user-agent header. */
  initialKind: DeviceKind;
  /** The server's guess that this is a home-screen launch (?source=homescreen from the manifest start_url). */
  initialStandalone: boolean;
  initialPlatform: InstallPlatform;
  overrides: GateOverrides;
  /** The app, rendered only on the in-app path. */
  children: ReactNode;
}

interface ClientFacts {
  kind: DeviceKind;
  standalone: boolean;
  continuedInBrowser: boolean;
  platform: InstallPlatform;
}

/**
 * Computer -> QR page. Phone in a browser tab -> add-to-home-screen steps. Home-screen launch -> the app.
 * Renders the server's guess first (no flash in the common case), then confirms in the browser.
 */
export default function DeviceGate({ initialKind, initialStandalone, initialPlatform, overrides, children }: DeviceGateProps) {
  const [facts, setFacts] = useState<ClientFacts>({
    kind: initialKind,
    standalone: initialStandalone,
    continuedInBrowser: false,
    platform: initialPlatform,
  });
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // Confirming once on mount is the point of this effect: the server could only guess from the user agent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFacts({
      kind: detectClientKind(),
      standalone: detectStandalone(),
      continuedInBrowser: readContinuedInBrowser(),
      platform: detectClientPlatform(),
    });
    setConfirmed(true);
  }, []);

  const view = decideView({ overrides, ...facts });

  // A guessed home-screen launch shows the launch background until the browser confirms it,
  // so the app never mounts in a tab that should have shown the install steps.
  if (view === "app" && !confirmed && !overrides.standalone) return <LaunchScreen />;
  if (view === "app") return <>{children}</>;
  if (view === "qr") return <DesktopQr />;

  function continueInBrowser() {
    rememberContinuedInBrowser();
    setFacts((current) => ({ ...current, continuedInBrowser: true }));
  }

  return <InstallSteps platform={facts.platform} onContinueInBrowser={continueInBrowser} />;
}
