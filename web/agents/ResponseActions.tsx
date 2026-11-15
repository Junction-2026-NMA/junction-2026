"use client";
// The completion actions of beUI StreamingResponse (https://beui.dev/components/agents/streaming-response, MIT, see
// web/agents/LICENSE): small icon buttons that rise in under a finished answer. Sisu keeps Copy only: there is no
// feedback service behind thumbs up or down, so those are left out rather than shown doing nothing. "Copied" shows
// only when the clipboard took the text. Restyled with the Sisu tokens in agents.css.
import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { EASE_OUT, SPRING_SWAP, cx } from "./motion";
import "./agents.css";

export function ResponseActions({ copyText, className, testId }: { copyText: string; className?: string; testId?: string }) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const label = copied ? "Copied" : "Copy answer";
  return (
    <motion.div className={cx("sisu-agent-response-actions", className)} data-testid={testId}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE_OUT }}>
      <motion.button type="button" className="sisu-agent-response-action" aria-label={label} title={label}
        whileTap={reduce ? undefined : { scale: 0.9 }} onClick={() => void copy()} data-testid={testId ? `${testId}.copy` : undefined}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={copied ? "copied" : "copy"} className="sisu-agent-response-icon"
            initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} transition={reduce ? { duration: 0 } : SPRING_SWAP}>
            {copied ? <Check size={16} strokeWidth={2.2} aria-hidden="true" /> : <Copy size={16} strokeWidth={2} aria-hidden="true" />}
          </motion.span>
        </AnimatePresence>
        <span className="sisu-agent-response-label" aria-hidden="true">{label}</span>
      </motion.button>
    </motion.div>
  );
}
