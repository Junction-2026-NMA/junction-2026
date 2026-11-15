"use client";
// beUI AgentDisclosure (https://beui.dev/components/agents, MIT, see web/agents/LICENSE): the shared reveal of the
// agent components. Opening clips the content in from the top while it fades and settles; closed, it takes no room
// and is inert, so it is neither read out nor tabbed to.
import { motion, type HTMLMotionProps } from "motion/react";
import type { CSSProperties } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { EASE_OUT, cx } from "./motion";

export function AgentDisclosure({ open, openHeight = "auto", className, style, ...props }: Omit<HTMLMotionProps<"div">, "animate" | "initial"> & {
  open: boolean;
  openHeight?: CSSProperties["height"];
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      {...props}
      aria-hidden={!open}
      inert={!open}
      initial={false}
      animate={reduce
        ? { opacity: open ? 1 : 0 }
        : { opacity: open ? 1 : 0, clipPath: open ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)", y: open ? 0 : -4 }}
      transition={{ duration: reduce ? 0 : open ? 0.22 : 0.14, ease: EASE_OUT }}
      className={cx("sisu-agent-disclosure", className)}
      style={{ ...style, height: open ? openHeight : 0, pointerEvents: open ? undefined : "none", transformOrigin: "top" }}
    />
  );
}
