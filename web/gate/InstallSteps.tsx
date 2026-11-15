"use client";

import "./gate.css";
import type { InstallPlatform } from "./detect";
import { AndroidSteps } from "./androidSteps";
import { InAppBrowserSteps } from "./inAppSteps";
import { IosOtherBrowserSteps, IosSafariSteps } from "./iosSteps";
import CopyLink from "./CopyLink";

interface InstallStepsProps {
  platform: InstallPlatform;
  /** Lets the person in without installing (for in-app browsers that cannot install). */
  onContinueInBrowser: () => void;
}

/** The phone-in-a-browser-tab view: add Sisu to the home screen first, with steps for this browser. */
export default function InstallSteps({ platform, onContinueInBrowser }: InstallStepsProps) {
  return (
    <main className="sisu-gate">
      <div className="sisu-gate-install">
        <header className="sisu-gate-head">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 64 px icon from public/ */}
          <img className="sisu-gate-icon" src="/app-icons/icon-180.png" alt="" width={64} height={64} />
          <h1 className="sisu-gate-title">Add Sisu to your home screen</h1>
          <p className="sisu-gate-lead">Then it opens full screen and works like an app on your phone.</p>
        </header>
        <PlatformSteps platform={platform} />
        <button type="button" className="sisu-gate-continue" onClick={onContinueInBrowser}>
          Continue in the browser
        </button>
      </div>
    </main>
  );
}

function PlatformSteps({ platform }: { platform: InstallPlatform }) {
  switch (platform.kind) {
    case "iosSafari":
      return <IosSafariSteps />;
    case "iosOtherBrowser":
      return <IosOtherBrowserSteps browser={platform.browser} canAddToHomeScreen={platform.canAddToHomeScreen} />;
    case "inAppBrowser":
      return <InAppBrowserSteps app={platform.app} ios={platform.ios} />;
    case "android":
      return <AndroidSteps browser={platform.browser} />;
    case "other":
      return (
        <>
          <div className="sisu-gate-card">
            <ol className="sisu-gate-steps">
              <li className="sisu-gate-step">
                <span>
                  Open your browser&apos;s menu and choose <strong>Add to Home Screen</strong> or{" "}
                  <strong>Install app</strong>.
                </span>
              </li>
              <li className="sisu-gate-step">
                <span>
                  Open <strong>Sisu</strong> from your home screen.
                </span>
              </li>
            </ol>
          </div>
          <p className="sisu-gate-note">No such option? Open this page in Safari (iPhone) or Chrome (Android).</p>
          <CopyLink />
        </>
      );
  }
}
