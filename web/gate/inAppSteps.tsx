// Steps for an app's built-in browser (Instagram, LinkedIn...): it cannot install, so hand over to the real browser.
import CopyLink from "./CopyLink";
import { AddToHomeGlyph, MoreHorizontalGlyph, MoreVerticalGlyph, ShareGlyph } from "./glyphs";

export function InAppBrowserSteps({ app, ios }: { app: string; ios: boolean }) {
  const browser = ios ? "Safari" : "Chrome";
  return (
    <>
      <p className="sisu-gate-note">{app}&apos;s built-in browser can&apos;t add Sisu to your home screen.</p>
      <div className="sisu-gate-card">
        <ol className="sisu-gate-steps">
          <li className="sisu-gate-step">
            <span>
              Tap {ios ? <MoreHorizontalGlyph /> : <MoreVerticalGlyph />} and choose{" "}
              <strong>Open in {browser}</strong> or <strong>Open in browser</strong>. Or copy the link below and paste
              it into {browser}.
            </span>
          </li>
          <li className="sisu-gate-step">
            {ios ? (
              <span>
                In Safari, tap <strong>Share</strong> <ShareGlyph />, then <strong>Add to Home Screen</strong>{" "}
                <AddToHomeGlyph />.
              </span>
            ) : (
              <span>
                In Chrome, tap <MoreVerticalGlyph />, then <strong>Add to Home screen</strong> or{" "}
                <strong>Install app</strong>.
              </span>
            )}
          </li>
          <li className="sisu-gate-step">
            <span>
              Open <strong>Sisu</strong> from your home screen.
            </span>
          </li>
        </ol>
      </div>
      <CopyLink />
    </>
  );
}
