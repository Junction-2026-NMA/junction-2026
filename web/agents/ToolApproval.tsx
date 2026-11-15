"use client";
// beUI ToolApproval (https://beui.dev/components/agents/tool-approval, MIT, see web/agents/LICENSE), restyled with
// the Sisu tokens in agents.css: an icon tile that follows the decision (shield, spinner, check, cross, clock), the
// title with the status badge and the kind of action under it (beUI puts the badge beside the title; a phone has no
// room for that), the body, "details" behind a chevron, and the action row
// with a hairline above it, which leaves once the decision is made; the result takes its place. The caller passes
// the controls (Sisu's own buttons), so the row keeps the app's look.
import { Check, ChevronDown, CircleAlert, Clock, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { AgentDisclosure } from "./AgentDisclosure";
import { EASE_OUT, SPRING_SWAP, cx } from "./motion";
import "./agents.css";

export type ToolApprovalStatus = "pending" | "approving" | "approved" | "denied" | "expired" | "other";

export function ToolApproval({ status, title, tool, badge, description, children, detailsLabel, details, actions, result, className, testId }: {
  status: ToolApprovalStatus;
  title: ReactNode;
  /** The line under the title (beUI shows the tool's name): here, what kind of action it is. */
  tool?: ReactNode;
  /** The status badge's words. */
  badge: string;
  description?: ReactNode;
  /** More of the card's body, under the description. */
  children?: ReactNode;
  detailsLabel?: ReactNode;
  /** Shown when the person opens `detailsLabel`. */
  details?: ReactNode;
  /** The controls, shown while the decision is open (pending or approving). */
  actions?: ReactNode;
  /** Shown once the decision is made. */
  result?: ReactNode;
  className?: string;
  testId?: string;
}) {
  const reduce = useReducedMotion();
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const deciding = status === "pending" || status === "approving";
  return (
    <div className={cx("sisu-agent-approval", className)} data-status={status} aria-busy={status === "approving"} data-testid={testId}>
      <div className="sisu-agent-approval-head">
        <span className="sisu-agent-approval-icon" data-status={status} aria-hidden="true">
          <StatusIcon status={status} reduce={reduce} />
        </span>
        <div className="sisu-agent-approval-titles">
          <h2 className="sisu-agent-approval-title">{title}</h2>
          {/* On a phone the badge sits under the title, beside the kind of action, so the title keeps its width. */}
          <div className="sisu-agent-approval-meta">
            <span className="sisu-agent-approval-badge" data-status={status}>{badge}</span>
            {tool ? <span className="sisu-agent-approval-tool">{tool}</span> : null}
          </div>
        </div>
      </div>
      {description ? <p className="sisu-agent-approval-description">{description}</p> : null}
      {children}
      {details ? (
        <>
          <button type="button" className="sisu-agent-approval-details" aria-expanded={open} aria-controls={detailsId}
            onClick={() => setOpen((was) => !was)} data-testid={testId ? `${testId}.details` : undefined}>
            <span>{detailsLabel}</span>
            <motion.span aria-hidden="true" className="sisu-agent-approval-chevron" animate={{ rotate: open ? 180 : 0 }}
              transition={reduce ? { duration: 0 } : SPRING_SWAP}>
              <ChevronDown size={16} strokeWidth={2} />
            </motion.span>
          </button>
          <AgentDisclosure id={detailsId} role="region" open={open}>
            <div className="sisu-agent-approval-details-body">{details}</div>
          </AgentDisclosure>
        </>
      ) : null}
      <AnimatePresence initial={false} mode="popLayout">
        {deciding && actions ? (
          <motion.div key="actions" className="sisu-agent-approval-actions"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE_OUT }}>
            {actions}
          </motion.div>
        ) : !deciding && result ? (
          <motion.div key="result" className="sisu-agent-approval-result"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE_OUT }}>
            {result}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StatusIcon({ status, reduce }: { status: ToolApprovalStatus; reduce: boolean }) {
  if (status === "approving") return <LoaderCircle size={18} className={reduce ? undefined : "sisu-agent-spin"} />;
  if (status === "approved") return <Check size={18} strokeWidth={2.2} />;
  if (status === "denied") return <X size={18} strokeWidth={2.2} />;
  if (status === "expired") return <Clock size={18} />;
  if (status === "other") return <CircleAlert size={18} />;
  return <ShieldCheck size={18} />;
}
