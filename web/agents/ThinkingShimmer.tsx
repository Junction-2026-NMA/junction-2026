"use client";
// beUI ThinkingShimmer / TextShimmer (https://beui.dev/components/agents/loading-states, MIT, see
// web/agents/LICENSE): status text with a light sweeping across it, in Sisu's muted text and green. The sweep is a
// CSS animation in agents.css, so it stops under Reduce Motion.
import type { ElementType, ReactNode } from "react";
import { cx } from "./motion";
import "./agents.css";

export function ThinkingShimmer({ children, as: Tag = "span", duration = 1.8, className }: {
  children: ReactNode;
  as?: ElementType;
  /** Seconds for one pass of the light. */
  duration?: number;
  className?: string;
}) {
  return (
    <Tag className={cx("sisu-agent-shimmer", className)} style={{ animationDuration: `${duration}s` }}>
      {children}
    </Tag>
  );
}
