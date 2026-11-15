"use client";
// beUI AgentProgress (https://beui.dev/components/agents/loading-states, MIT, see web/agents/LICENSE): a 3 by 3
// grid that pulses cell by cell, the label, and the time since the work started (real elapsed time, from
// `startedAt`, so it keeps counting across a remount). Restyled with Sisu tokens; the grid is Sisu green.
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { cx } from "./motion";
import "./agents.css";

const CELLS = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 0.98, 1.12];
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/** `3.4 s`, `1 min 12.0 s`. */
export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = `${(safe % 60).toFixed(1)} s`;
  return minutes > 0 ? `${minutes} min ${seconds}` : seconds;
}

export function AgentProgress({ label, startedAt, running = true, className }: {
  label: ReactNode;
  /** When the work started (ms since the epoch). */
  startedAt: number;
  running?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [running]);
  return (
    <span className={cx("sisu-agent-progress", className)}>
      <span aria-hidden="true" className="sisu-agent-progress-grid">
        {CELLS.map((delay) => (
          <motion.span
            key={delay}
            className="sisu-agent-progress-cell"
            animate={reduce ? { opacity: [0.35, 0.8, 0.35] } : { opacity: [0.28, 1, 0.28], scale: [0.72, 1, 0.72] }}
            transition={{ duration: 1.55, ease: EASE_IN_OUT, repeat: Infinity, delay }}
          />
        ))}
      </span>
      <span className="sisu-agent-progress-label">{label}</span>
      <span aria-hidden="true" className="sisu-agent-progress-time">{formatElapsed((now - startedAt) / 1000)}</span>
    </span>
  );
}
