// Install steps for iPhone: Safari and the other iOS browsers.
import CopyLink from "./CopyLink";
import { AddToHomeGlyph, MoreHorizontalGlyph, ShareGlyph } from "./glyphs";

function AddAndOpenSteps() {
  return (
    <>
      <li className="sisu-gate-step">
        <span>
          Scroll down and tap <strong>Add to Home Screen</strong> <AddToHomeGlyph />.
        </span>
      </li>
      <li className="sisu-gate-step">
        <span>
          Tap <strong>Add</strong>, then open <strong>Sisu</strong> from your home screen.
        </span>
      </li>
    </>
  );
}

export function IosSafariSteps() {
  return (
    <div className="sisu-gate-card">
      <ol className="sisu-gate-steps">
        <li className="sisu-gate-step">
          <span>
            Tap <strong>Share</strong> <ShareGlyph /> in Safari&apos;s toolbar. Don&apos;t see it? Tap{" "}
            <MoreHorizontalGlyph /> first.
          </span>
        </li>
        <AddAndOpenSteps />
      </ol>
    </div>
  );
}

export function IosOtherBrowserSteps({ browser, canAddToHomeScreen }: { browser: string; canAddToHomeScreen: boolean }) {
  if (!canAddToHomeScreen) return <OpenInSafari reason={`${browser} on this iPhone can't add pages to the home screen.`} />;
  return (
    <>
      <div className="sisu-gate-card">
        <ol className="sisu-gate-steps">
          <li className="sisu-gate-step">
            <span>
              Tap <strong>Share</strong> <ShareGlyph /> in {browser}. It can be next to the address bar or in the{" "}
              <MoreHorizontalGlyph /> menu.
            </span>
          </li>
          <AddAndOpenSteps />
        </ol>
      </div>
      <p className="sisu-gate-note">No &ldquo;Add to Home Screen&rdquo;? Open this page in Safari and add it from there.</p>
      <CopyLink />
    </>
  );
}

function OpenInSafari({ reason }: { reason: string }) {
  return (
    <>
      <p className="sisu-gate-note">{reason}</p>
      <div className="sisu-gate-card">
        <ol className="sisu-gate-steps">
          <li className="sisu-gate-step">
            <span>Copy the link below and open it in Safari.</span>
          </li>
          <li className="sisu-gate-step">
            <span>
              In Safari, tap <strong>Share</strong> <ShareGlyph />, then <strong>Add to Home Screen</strong>{" "}
              <AddToHomeGlyph />.
            </span>
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
