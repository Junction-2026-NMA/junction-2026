"use client";
// beUI AgentActivity (https://beui.dev/components/agents/agent-activity, MIT, see web/agents/LICENSE), cut down
// to the step rows Sisu has and restyled with the Sisu tokens in agents.css. While the agent works, a shimmering
// status line sits over the steps, which rise in as they arrive; past `maxHeight` the list glides so the newest
// step stays in view. Once done it folds into one line (the summary and a chevron) that opens the steps again.
// Sisu adds the "failed" state (a step that did not finish) and a detail line under a step (its result).
import { Check, ChevronDown, Circle, CircleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { ThinkingShimmer } from "./ThinkingShimmer";
import { EASE_OUT, SPRING_LAYOUT, SPRING_SWAP, cx } from "./motion";
import "./agents.css";

export type AgentStepStatus = "pending" | "active" | "complete" | "failed";

export interface AgentActivityStep {
  id: string;
  label: ReactNode;
  status: AgentStepStatus;
  /** What the mark means, for screen readers ("Done", "Running"). */
  statusLabel: string;
  /** A second, quieter line: what the step found. */
  detail?: ReactNode;
  /** Trailing text, such as the step's duration. */
  meta?: ReactNode;
}

export function AgentActivity({ items, working, activeLabel, summary, maxHeight = 208, className, testId }: {
  items: readonly AgentActivityStep[];
  /** True while the agent is still on it: the steps stay open and the status line shimmers. */
  working: boolean;
  activeLabel: ReactNode;
  /** The folded line once done ("What Sisu did · 3 steps"). */
  summary: ReactNode;
  maxHeight?: number;
  className?: string;
  testId?: string;
}) {
  const reduce = useReducedMotion();
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const contentId = `${baseId}-content`;
  const content = useRef<HTMLOListElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [open, setOpen] = useState(false);
  const expanded = working || open;
  const viewportHeight = Math.min(contentHeight, Math.max(0, maxHeight));
  const capped = contentHeight > maxHeight;
  const streamOffset = working ? Math.min(0, viewportHeight - contentHeight) : 0;

  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => setContentHeight(node.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) requestAnimationFrame(() => viewport.current?.scrollTo({ top: 0 }));
  };

  const mask = capped
    ? working
      ? "linear-gradient(to bottom, transparent, black 12px)"
      : "linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)"
    : undefined;
  const rowMotion = reduce
    ? { initial: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 6 },
        exit: { opacity: 0, y: -3 },
        transition: { opacity: { duration: 0.18, ease: EASE_OUT }, y: SPRING_LAYOUT, layout: SPRING_LAYOUT },
      };

  return (
    <div className={cx("sisu-agent-activity", className)} data-state={working ? "working" : expanded ? "open" : "closed"} aria-busy={working}
      data-testid={testId}>
      {working ? (
        <div id={triggerId} role="status" className="sisu-agent-activity-status">
          <ThinkingShimmer>{activeLabel}</ThinkingShimmer>
        </div>
      ) : (
        <button id={triggerId} type="button" className="sisu-agent-activity-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={toggle}>
          <span className="sisu-agent-activity-summary">{summary}</span>
          <motion.span aria-hidden="true" className="sisu-agent-activity-chevron" animate={{ rotate: expanded ? 180 : 0 }}
            transition={reduce ? { duration: 0 } : SPRING_SWAP}>
            <ChevronDown size={16} strokeWidth={2} />
          </motion.span>
        </button>
      )}
      <motion.div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        aria-hidden={!expanded}
        inert={!expanded}
        className="sisu-agent-activity-disclosure"
        initial={false}
        animate={reduce
          ? { opacity: expanded ? 1 : 0 }
          : { opacity: expanded ? 1 : 0, clipPath: expanded ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)", y: expanded ? 0 : -4 }}
        transition={{ duration: reduce ? 0 : expanded ? 0.22 : 0.14, ease: EASE_OUT }}
        style={{ height: expanded ? viewportHeight : 0, pointerEvents: expanded ? undefined : "none", transformOrigin: "top" }}
      >
        <div ref={viewport} className="sisu-agent-activity-viewport" data-scroll={capped && expanded && !working ? "true" : "false"}
          style={{ height: viewportHeight, maskImage: mask, WebkitMaskImage: mask }}>
          <motion.ol ref={content} className="sisu-agent-activity-list" initial={false} animate={{ y: streamOffset }}
            transition={reduce ? { duration: 0 } : SPRING_LAYOUT} aria-live={working ? "polite" : "off"}>
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map((item) => (
                <motion.li key={item.id} layout="position" className="sisu-agent-step" data-status={item.status}
                  initial={rowMotion.initial} animate={{ opacity: 1, y: 0 }} exit={rowMotion.exit} transition={rowMotion.transition}>
                  <StepMark status={item.status} label={item.statusLabel} />
                  <span className="sisu-agent-step-text">
                    <span className="sisu-agent-step-top">
                      <span className="sisu-agent-step-label">{item.label}</span>
                      {item.meta ? <span className="sisu-agent-step-meta">{item.meta}</span> : null}
                    </span>
                    {item.detail ? <span className="sisu-agent-step-detail">{item.detail}</span> : null}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ol>
        </div>
      </motion.div>
    </div>
  );
}

function StepMark({ status, label }: { status: AgentStepStatus; label: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="sisu-agent-step-mark" data-status={status} role="img" aria-label={label}>
      {status === "complete" ? <Check size={16} strokeWidth={2.2} aria-hidden="true" /> : null}
      {status === "failed" ? <CircleAlert size={16} strokeWidth={2} aria-hidden="true" /> : null}
      {status === "pending" ? <Circle size={12} strokeWidth={1.8} aria-hidden="true" /> : null}
      {status === "active" ? (
        <span className="sisu-agent-step-pulse" aria-hidden="true">
          <motion.span className="sisu-agent-step-pulse-halo" animate={reduce ? { opacity: 0.6 } : { opacity: [0.35, 0.9, 0.35] }}
            transition={{ duration: 1.5, repeat: Infinity }} />
          <span className="sisu-agent-step-pulse-core" />
        </span>
      ) : null}
    </span>
  );
}
