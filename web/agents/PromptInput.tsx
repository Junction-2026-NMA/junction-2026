"use client";
// beUI PromptInput (https://beui.dev/components/agents/prompt-input, MIT, see web/agents/LICENSE), restyled with the
// Sisu tokens in agents.css. Sisu's ask box has no action menu and no model picker, so those are left out; what
// stays is beUI's composer: a field that grows with a hidden mirror of the text (one line to `maxRows`, then it
// scrolls), Return to send (Shift+Return adds a line, IME composition is respected) and the Send button that
// swaps to Stop with a small spring while the agent works. The Send and Stop presses keep the field focused, so
// the iOS keyboard stays up, as in the app before.
import { ArrowUp, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { SPRING_SWAP, cx } from "./motion";
import "./agents.css";

/** Body text is 16 px at 1.4 (iOS does not zoom into a 16 px field); the field has 10 px top and bottom padding. */
const LINE = 16 * 1.4;
const PADDING = 20;

export function PromptInput({
  value, onValueChange, onSubmit, loading, onStop, placeholder, label, textareaRef, maxRows = 4, onFocusChange, className,
  testIds,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** The agent is working: Send becomes Stop, and Return does not send. */
  loading: boolean;
  onStop: () => void;
  placeholder: string;
  label: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  maxRows?: number;
  onFocusChange?: (focused: boolean) => void;
  className?: string;
  testIds?: { field?: string; send?: string; stop?: string };
}) {
  const reduce = useReducedMotion();
  const mirror = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const canSubmit = value.trim() !== "" && !loading;

  // Grow with the text, measured on the mirror (beUI): one line to maxRows, then scroll inside.
  useLayoutEffect(() => {
    const field = textareaRef.current, copy = mirror.current;
    if (!field || !copy) return;
    const max = Math.ceil(LINE * maxRows) + PADDING;
    const height = `${Math.min(Math.max(copy.scrollHeight, Math.ceil(LINE) + PADDING), max)}px`;
    if (field.style.height !== height) field.style.height = height;
    field.style.overflowY = copy.scrollHeight > max ? "auto" : "hidden";
  }, [value, maxRows, textareaRef]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (canSubmit) onSubmit(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || composing.current || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <form className={cx("sisu-agent-prompt", className)} onSubmit={submit}>
      <div className="sisu-agent-prompt-fieldwrap">
        <div ref={mirror} aria-hidden="true" className="sisu-agent-prompt-mirror">{`${value}​`}</div>
        <textarea
          ref={textareaRef}
          className="sisu-agent-prompt-field"
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label={label}
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="on"
          spellCheck
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          data-testid={testIds?.field}
        />
      </div>
      <motion.button
        type={loading ? "button" : "submit"}
        className="sisu-agent-prompt-send"
        data-variant={loading ? "stop" : canSubmit ? "ready" : "idle"}
        disabled={!loading && !canSubmit}
        aria-label={loading ? "Stop Sisu" : "Send"}
        data-testid={loading ? testIds?.stop : testIds?.send}
        whileTap={reduce ? undefined : { scale: 0.92 }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={loading ? onStop : undefined}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={loading ? "stop" : "send"}
            className="sisu-agent-prompt-icon"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 3, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.8 }}
            transition={reduce ? { duration: 0 } : SPRING_SWAP}
          >
            {loading ? <Square size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" /> : <ArrowUp size={20} strokeWidth={2.4} aria-hidden="true" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </form>
  );
}
