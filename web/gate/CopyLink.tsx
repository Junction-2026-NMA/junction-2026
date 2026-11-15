"use client";

import { useState } from "react";

/** Copies this page's /app link, for browsers that must hand over to Safari or Chrome. */
export default function CopyLink() {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const url = `${window.location.origin}/app`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="sisu-gate-link-row">
      <button type="button" className="sisu-gate-secondary" onClick={copy}>
        Copy link
      </button>
      <span className="sisu-gate-note" aria-live="polite">
        {copied === "copied" ? "Copied. Paste it into the address bar." : null}
        {copied === "failed" ? "Could not copy. The address is this page's, ending in /app." : null}
      </span>
    </div>
  );
}
