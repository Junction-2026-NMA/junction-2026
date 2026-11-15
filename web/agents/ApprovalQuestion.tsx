"use client";
// The question mode of beUI ApprovalCard (https://beui.dev/components/agents/approval-card, MIT, see
// web/agents/LICENSE), for a guess-first question: a status icon and badge, the question, the options as a radio
// group, and the result revealed under them. Sisu's quiz takes the first tap as the answer (beUI's auto-advance),
// so there is no submit button; once answered the options lock and each one shows whether it was right. A wrong
// guess is marked calmly, never in red. Restyled with the Sisu tokens in agents.css.
import { Check, CircleHelp, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { AgentDisclosure } from "./AgentDisclosure";
import { SPRING_SWAP, cx } from "./motion";
import "./agents.css";

export type ApprovalOptionState = "idle" | "correct" | "wrong";

export function ApprovalQuestion({ title, titleHidden = false, badge, options, answered, onChoose, result, className, testIdPrefix }: {
  title: ReactNode;
  /** The question is already on screen (the answer ends with it): kept for screen readers only. */
  titleHidden?: boolean;
  badge: string;
  options: readonly { label: string; state: ApprovalOptionState; selected: boolean }[];
  answered: boolean;
  onChoose: (index: number) => void;
  /** Shown under the options once answered. */
  result?: ReactNode;
  className?: string;
  /** `<prefix>.<index>` on each option. */
  testIdPrefix?: string;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  return (
    <div className={cx("sisu-agent-question", className)} data-state={answered ? "answered" : "pending"}>
      <div className="sisu-agent-approval-head">
        <span className="sisu-agent-approval-icon" data-status={answered ? "approved" : "pending"} aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={answered ? "answered" : "pending"} className="sisu-agent-question-icon"
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} transition={reduce ? { duration: 0 } : SPRING_SWAP}>
              {answered ? <Check size={18} strokeWidth={2.2} /> : <CircleHelp size={18} />}
            </motion.span>
          </AnimatePresence>
        </span>
        <div className="sisu-agent-approval-titles" data-centred={titleHidden ? "true" : "false"}>
          <h3 id={titleId} className={titleHidden ? "sisu-agent-visually-hidden" : "sisu-agent-approval-title"}>{title}</h3>
          <div className="sisu-agent-approval-meta">
            <span className="sisu-agent-approval-badge" data-status={answered ? "approved" : "pending"}>{badge}</span>
          </div>
        </div>
      </div>
      <div role="radiogroup" aria-labelledby={titleId} className="sisu-agent-question-options">
        {options.map((option, index) => (
          <motion.button key={index} type="button" role="radio" className="sisu-agent-question-option" data-state={option.state}
            aria-checked={option.selected} aria-disabled={answered} data-locked={answered ? "true" : "false"}
            data-testid={testIdPrefix ? `${testIdPrefix}.${index}` : undefined}
            whileTap={answered || reduce ? undefined : { scale: 0.98 }}
            onClick={() => { if (!answered) onChoose(index); }}>
            <span className="sisu-agent-question-mark" data-state={option.state} aria-hidden="true">
              <AnimatePresence initial={false} mode="popLayout">
                {option.state === "idle" ? null : (
                  <motion.span key={option.state} className="sisu-agent-question-mark-glyph"
                    initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                    transition={reduce ? { duration: 0 } : SPRING_SWAP}>
                    {option.state === "correct" ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="sisu-agent-question-label">{option.label}</span>
            {option.state === "correct" ? <span className="sisu-agent-visually-hidden">(right answer)</span> : null}
            {option.state === "wrong" ? <span className="sisu-agent-visually-hidden">(your guess)</span> : null}
          </motion.button>
        ))}
      </div>
      <AgentDisclosure open={answered && result != null}>
        <div className="sisu-agent-question-result" role="status" aria-live="polite">{answered ? result : null}</div>
      </AgentDisclosure>
    </div>
  );
}
