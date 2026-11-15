"use client";
// beUI AgentActivity (https://beui.dev/components/agents/agent-activity, MIT, see web/agents/LICENSE), cut down
// to the rows Sisu has and restyled with the Sisu tokens in agents.css. While the agent works, a live status line
// (by default beUI's shimmer) sits over the rows, which rise in as they arrive; past `maxHeight` the list glides so
// the newest row stays in view. Once done it folds into one line (the summary and a chevron) that opens it again.
// Rows: a step (Sisu adds the "failed" state and a detail line under a step) and a web search (the query as it was
// sent, and the pages that came back, each opening in a new tab).
import { Check, ChevronDown, Circle, CircleAlert, Globe, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { AgentDisclosure } from "./AgentDisclosure";
import { ThinkingShimmer } from "./ThinkingShimmer";
import { EASE_OUT, SPRING_LAYOUT, SPRING_SWAP, cx } from "./motion";
import "./agents.css";

export type AgentStepStatus = "pending" | "active" | "complete" | "failed";

export interface AgentActivityStep {
  type: "step";
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

export interface AgentSearchResult {
  id: string;
  title: ReactNode;
  domain?: ReactNode;
  url?: string;
}

export interface AgentActivitySearch {
  type: "search";
  id: string;
  query: ReactNode;
  /** Trailing text: the search provider, or that the results are mock data. */
  meta?: ReactNode;
  results: readonly AgentSearchResult[];
  /** Results not listed. */
  moreCount?: number;
}

export type AgentActivityItem = AgentActivityStep | AgentActivitySearch;

export function AgentActivity({ items, working, activeLabel, status, summary, maxHeight = 208, className, testId }: {
  items: readonly AgentActivityItem[];
  /** True while the agent is still on it: the rows stay open and the status line is live. */
  working: boolean;
  activeLabel: ReactNode;
  /** The live status line, in place of the shimmering `activeLabel` (for example AgentProgress). */
  status?: ReactNode;
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

  return (
    <div className={cx("sisu-agent-activity", className)} data-state={working ? "working" : expanded ? "open" : "closed"} aria-busy={working}
      data-testid={testId}>
      {working ? (
        <div id={triggerId} role="status" className="sisu-agent-activity-status">
          {status ?? <ThinkingShimmer>{activeLabel}</ThinkingShimmer>}
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
      <AgentDisclosure id={contentId} role="region" aria-labelledby={triggerId} open={expanded} openHeight={viewportHeight}>
        <div ref={viewport} className="sisu-agent-activity-viewport" data-scroll={capped && expanded && !working ? "true" : "false"}
          style={{ height: viewportHeight, maskImage: mask, WebkitMaskImage: mask }}>
          <motion.ol ref={content} className="sisu-agent-activity-list" initial={false} animate={{ y: streamOffset }}
            transition={reduce ? { duration: 0 } : SPRING_LAYOUT} aria-live={working ? "polite" : "off"}>
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map((item) => (
                <motion.li key={item.id} className="sisu-agent-row" {...rise(reduce)}>
                  {item.type === "search" ? <SearchRow item={item} /> : <StepRow item={item} />}
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ol>
        </div>
      </AgentDisclosure>
    </div>
  );
}

/** A row rises in when it arrives and keeps its place as rows around it come and go (motion props). */
function rise(reduce: boolean) {
  return {
    layout: "position" as const,
    initial: reduce ? { opacity: 1 } : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -3 },
    transition: reduce ? { duration: 0 } : { opacity: { duration: 0.18, ease: EASE_OUT }, y: SPRING_LAYOUT, layout: SPRING_LAYOUT },
  };
}

function StepRow({ item }: { item: AgentActivityStep }) {
  return (
    <div className="sisu-agent-step" data-status={item.status}>
      <StepMark status={item.status} label={item.statusLabel} />
      <span className="sisu-agent-step-text">
        <span className="sisu-agent-step-top">
          <span className="sisu-agent-step-label">{item.label}</span>
          {item.meta ? <span className="sisu-agent-step-meta">{item.meta}</span> : null}
        </span>
        {item.detail ? <span className="sisu-agent-step-detail">{item.detail}</span> : null}
      </span>
    </div>
  );
}

function SearchRow({ item }: { item: AgentActivitySearch }) {
  const reduce = useReducedMotion();
  return (
    <div className="sisu-agent-search">
      <div className="sisu-agent-search-query">
        <Search size={16} strokeWidth={1.8} aria-hidden="true" className="sisu-agent-search-icon" />
        <span className="sisu-agent-search-text">{item.query}</span>
        {item.meta ? <span className="sisu-agent-step-meta">{item.meta}</span> : null}
      </div>
      {item.results.length > 0 ? (
        <div className="sisu-agent-search-results">
          <AnimatePresence initial mode="popLayout">
            {item.results.map((result) => (
              <motion.div key={result.id} className="sisu-agent-search-result-row" {...rise(reduce)}>
                <SearchResult result={result} />
              </motion.div>
            ))}
          </AnimatePresence>
          {item.moreCount ? <span className="sisu-agent-search-more">{`+${item.moreCount} more`}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function SearchResult({ result }: { result: AgentSearchResult }) {
  const content = (
    <>
      <Globe size={14} strokeWidth={2} aria-hidden="true" className="sisu-agent-search-globe" />
      <span className="sisu-agent-search-title">{result.title}</span>
      {result.domain ? <span className="sisu-agent-search-domain">{result.domain}</span> : null}
    </>
  );
  return result.url ? (
    <a className="sisu-agent-search-result" href={result.url} target="_blank" rel="noreferrer noopener">{content}</a>
  ) : (
    <span className="sisu-agent-search-result">{content}</span>
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
