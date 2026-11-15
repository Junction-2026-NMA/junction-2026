"use client";
// beUI CitationList (https://beui.dev/components/agents/citations, MIT, see web/agents/LICENSE): numbered source
// rows that rise in, each with its title, its domain and an external-link mark, opening in a new tab. Sisu adds a
// line for when the page was read (cached results say when they were retrieved). The favicon is a plain globe:
// fetching site icons would send the domains to another service. Restyled with the Sisu tokens in agents.css.
import { ExternalLink, Globe } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { EASE_OUT, SPRING_LAYOUT, cx } from "./motion";
import "./agents.css";

export interface CitationItem {
  id: string;
  title: ReactNode;
  domain?: ReactNode;
  url?: string;
  /** A quieter line: when the page was read. */
  meta?: ReactNode;
}

/** `www.elisa.fi/x` → `elisa.fi`; null for something that is not a web address. */
export function citationDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function CitationList({ citations, className }: { citations: readonly CitationItem[]; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <ol className={cx("sisu-agent-citations", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {citations.map((citation, index) => (
          <motion.li key={citation.id} layout="position"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3 }}
            transition={reduce ? { duration: 0 } : { opacity: { duration: 0.18, ease: EASE_OUT }, y: SPRING_LAYOUT, layout: SPRING_LAYOUT }}>
            <CitationRow citation={citation} index={index + 1} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function CitationRow({ citation, index }: { citation: CitationItem; index: number }) {
  const content = (
    <>
      <span className="sisu-agent-citation-icon" aria-hidden="true"><Globe size={14} strokeWidth={2} /></span>
      <span className="sisu-agent-citation-text">
        <span className="sisu-agent-citation-title">{citation.title}</span>
        {citation.domain ? <span className="sisu-agent-citation-domain">{citation.domain}</span> : null}
        {citation.meta ? <span className="sisu-agent-citation-meta">{citation.meta}</span> : null}
      </span>
      <span className="sisu-agent-citation-end" aria-hidden="true">
        <span className="sisu-agent-citation-index">{index}</span>
        {citation.url ? <ExternalLink size={14} strokeWidth={2} /> : null}
      </span>
    </>
  );
  return citation.url ? (
    <a className="sisu-agent-citation" href={citation.url} target="_blank" rel="noreferrer noopener">{content}</a>
  ) : (
    <div className="sisu-agent-citation">{content}</div>
  );
}
