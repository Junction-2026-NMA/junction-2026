"use client";

// Install for Android: a one-tap button when the browser offers beforeinstallprompt, else the menu steps.
import { useState, useSyncExternalStore } from "react";
import { MenuGlyph, MoreHorizontalGlyph, MoreVerticalGlyph } from "./glyphs";
import {
  getInstallPromptState,
  getServerInstallPromptState,
  promptInstall,
  subscribeInstallPrompt,
} from "./installPrompt";

type AndroidBrowser = "chrome" | "edge" | "samsung" | "firefox" | "other";

export function AndroidSteps({ browser }: { browser: AndroidBrowser }) {
  const promptState = useSyncExternalStore(subscribeInstallPrompt, getInstallPromptState, getServerInstallPromptState);
  const [failed, setFailed] = useState(false);

  async function install() {
    try {
      await promptInstall();
    } catch {
      setFailed(true);
    }
  }

  if (promptState === "installed") {
    return (
      <div className="sisu-gate-card">
        <ol className="sisu-gate-steps">
          <li className="sisu-gate-step">
            <span>
              Sisu is installed. Open <strong>Sisu</strong> from your home screen or app drawer.
            </span>
          </li>
        </ol>
      </div>
    );
  }

  return (
    <>
      {promptState === "available" ? (
        <button type="button" className="sisu-gate-button" onClick={install}>
          Install Sisu
        </button>
      ) : null}
      {failed ? <p className="sisu-gate-note">The install dialog did not open. Use the steps below.</p> : null}
      {promptState === "available" ? <p className="sisu-gate-note">Or add it from the menu:</p> : null}
      <div className="sisu-gate-card">
        <ol className="sisu-gate-steps">
          <MenuSteps browser={browser} />
          <li className="sisu-gate-step">
            <span>
              Open <strong>Sisu</strong> from your home screen.
            </span>
          </li>
        </ol>
      </div>
    </>
  );
}

function MenuSteps({ browser }: { browser: AndroidBrowser }) {
  if (browser === "samsung") {
    return (
      <>
        <li className="sisu-gate-step">
          <span>
            Tap the menu <MenuGlyph /> at the bottom right.
          </span>
        </li>
        <li className="sisu-gate-step">
          <span>
            Tap <strong>Add page to</strong>, then <strong>Home screen</strong>.
          </span>
        </li>
      </>
    );
  }
  if (browser === "edge") {
    return (
      <>
        <li className="sisu-gate-step">
          <span>
            Tap the menu <MoreHorizontalGlyph /> at the bottom.
          </span>
        </li>
        <li className="sisu-gate-step">
          <span>
            Tap <strong>Add to phone</strong> or <strong>Install app</strong>.
          </span>
        </li>
      </>
    );
  }
  return (
    <>
      <li className="sisu-gate-step">
        <span>
          Tap the menu <MoreVerticalGlyph /> {browser === "firefox" ? "next to the address bar" : "at the top right"}.
        </span>
      </li>
      <li className="sisu-gate-step">
        <span>
          Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>
          {browser === "firefox" ? <> (or <strong>Install</strong>)</> : null}.
        </span>
      </li>
    </>
  );
}
