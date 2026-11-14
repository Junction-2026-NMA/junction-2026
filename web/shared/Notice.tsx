"use client";
// A short notice said once, in place, at the moment something changes: for example when the app falls back from
// live to demo data because the backend cannot be reached. It shows for a few seconds (screen readers read it
// out through a polite live region), then fades; a tap dismisses it. Each `id` is said once per launch (page
// load). Never a permanent badge. Port of TransientNotice and NoticeLedger in ios/Sisu/Shared/SisuStyle.swift.
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { SisuMotion } from "./SisuStyle";
import "./shared.css";

/** Which transient notices were already said in this launch. */
export const NoticeLedger = {
  said: new Set<string>(),
  /** True the first time an id is claimed. */
  claim(id: string): boolean {
    if (NoticeLedger.said.has(id)) return false;
    NoticeLedger.said.add(id);
    return true;
  },
};

type Stage = "hidden" | "shown" | "leaving";

export function TransientNotice({ id, text, seconds = 8 }: { id: string; text: string; seconds?: number }) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>("hidden");
  // The id this notice claimed. A ref, so React's development double-run of effects does not lose the claim.
  const claimed = useRef<string | null>(null);

  useEffect(() => {
    if (claimed.current !== id) {
      if (!NoticeLedger.claim(id)) return;
      claimed.current = id;
    }
    setStage("shown");
    const timer = window.setTimeout(() => setStage("leaving"), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [id, seconds]);

  useEffect(() => {
    if (stage !== "leaving") return;
    const timer = window.setTimeout(() => setStage("hidden"), reduceMotion ? 200 : 300);
    return () => window.clearTimeout(timer);
  }, [stage, reduceMotion]);

  if (stage === "hidden") return <div className="sisu-notice-slot" aria-live="polite" />;
  return (
    <div className="sisu-notice-slot" aria-live="polite">
      <div
        className={`sisu-notice ${SisuMotion.entrance(reduceMotion)}${stage === "leaving" ? " sisu-notice-leaving" : ""}`}
        data-testid={`notice.${id}`}
        onClick={() => setStage("leaving")}
      >
        <InfoCircle />
        <span className="sisu-notice-text">{text}</span>
      </div>
    </div>
  );
}

/** SF Symbol "info.circle". */
function InfoCircle() {
  return (
    <svg className="sisu-notice-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="4.9" r="1" fill="currentColor" />
      <path d="M8 7.2v4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
