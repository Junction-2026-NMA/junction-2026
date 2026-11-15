"use client";
// beUI Message, MessageBubble and MessageTyping (https://beui.dev/components/agents/message, MIT, see
// web/agents/LICENSE), restyled with the Sisu tokens in agents.css. A row (`Message`) pops up from the live edge
// once when it is new; a bubble's surface pops in and follows its content's size (a voice question going from the
// typing dots to the words heard). The app's own Reduce Motion rule applies (web/theme/motion).
import { motion, type HTMLMotionProps } from "motion/react";
import { createContext, useContext, type ComponentPropsWithRef, type ReactNode } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { EASE_OUT, SPRING_BUBBLE, SPRING_LAYOUT, SPRING_POP_UP, cx } from "./motion";
import "./agents.css";

export type MessageFrom = "user" | "assistant";

const MessageContext = createContext<MessageFrom>("assistant");

export interface MessageProps extends Omit<HTMLMotionProps<"article">, "children"> {
  from: MessageFrom;
  /** Plays the pop-up once when the row mounts (a new question or answer, not one restored on screen). */
  animateIn?: boolean;
  children: ReactNode;
}

export function Message({ from, animateIn = false, className, style, children, ...props }: MessageProps) {
  const reduce = useReducedMotion();
  const pop = animateIn && !reduce;
  return (
    <MessageContext.Provider value={from}>
      <motion.article
        data-slot="message"
        data-from={from}
        initial={pop ? { opacity: 0, y: 8, scale: 0.95 } : animateIn ? { opacity: 0 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduce ? { duration: 0.12 } : SPRING_POP_UP}
        style={{ transformOrigin: from === "user" ? "100% 100%" : "0% 100%", ...style }}
        className={cx("sisu-agent-message", className)}
        {...props}
      >
        {children}
      </motion.article>
    </MessageContext.Provider>
  );
}

export function MessageContent({ className, ...props }: ComponentPropsWithRef<"div">) {
  const from = useContext(MessageContext);
  return <div data-slot="message-content" data-from={from} className={cx("sisu-agent-message-content", className)} {...props} />;
}

export type MessageBubbleVariant = "solid" | "soft";

export interface MessageBubbleProps extends ComponentPropsWithRef<"div"> {
  /** solid: the person's own words (Sisu green); soft: a quiet surface. */
  variant?: MessageBubbleVariant;
  animateIn?: boolean;
  /** Changes when the content's size may change, so the surface follows it (beUI's layoutDependency). */
  layoutKey?: string | number;
}

export function MessageBubble({ variant = "soft", animateIn = false, layoutKey, className, children, ...props }: MessageBubbleProps) {
  const reduce = useReducedMotion();
  const from = useContext(MessageContext);
  return (
    <div data-slot="message-bubble" data-variant={variant} data-from={from} className={cx("sisu-agent-bubble", className)} {...props}>
      <motion.span
        aria-hidden="true"
        className="sisu-agent-bubble-surface"
        layout={reduce ? false : "size"}
        layoutDependency={layoutKey}
        initial={animateIn && !reduce ? { opacity: 0, scale: 0.92 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0 } : { opacity: { duration: 0.12, ease: EASE_OUT }, scale: SPRING_BUBBLE, layout: SPRING_LAYOUT }}
      />
      <motion.div
        className="sisu-agent-bubble-text"
        initial={animateIn ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={reduce ? { duration: 0.12, ease: EASE_OUT } : { duration: 0.12, ease: EASE_OUT, delay: 0.04 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Three dots that rise in turn: a message still arriving (a voice question before its words are heard). */
export function MessageTyping({ label, className }: { label: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span data-slot="message-typing" className={cx("sisu-agent-typing", className)}>
      <span className="sisu-agent-visually-hidden">{label}</span>
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          aria-hidden="true"
          className="sisu-agent-typing-dot"
          animate={reduce ? { opacity: 0.45 } : { opacity: [0.28, 0.85, 0.28], y: [0, -2, 0] }}
          transition={{ duration: 1.05, ease: EASE_OUT, repeat: Infinity, delay: index * 0.14 }}
        />
      ))}
    </span>
  );
}
