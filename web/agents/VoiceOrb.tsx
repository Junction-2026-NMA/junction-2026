"use client";
// beUI VoiceOrb (https://beui.dev/components/agents/voice-orb, MIT, see web/agents/LICENSE): a grainy WebGL liquid
// sphere whose surface and outline follow a 0 to 1 voice level. It never opens a microphone: the caller passes the
// level (here the hands-free conversation's, web/voice/ConversationController.ts). Sisu passes its own greens. It
// draws only while on screen and the page is visible, and holds still under Reduce Motion. Where WebGL is missing
// it draws nothing, so the control it sits in still shows.
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/web/theme/motion";
import { SPRING_GLIDE, cx } from "./motion";
import { createOrbRenderer } from "./voiceOrbRenderer";
import "./agents.css";

/** Base pigment, highlight and shadow: Sisu green 500, green 200 and green 900 (web/theme/tokens.css). */
export const SISU_ORB_COLORS = ["#00aa46", "#91fa9b", "#004628"] as const;

const clampLevel = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);

export function VoiceOrb({ activity, colors = SISU_ORB_COLORS, active = true, speed = 1, className }: {
  /** The voice level, 0 to 1. */
  activity: number;
  colors?: readonly [string, string, string];
  /** False pauses the material (muted), keeping the surface visible. */
  active?: boolean;
  speed?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createOrbRenderer> | null>(null);
  const [failed, setFailed] = useState(false);
  const target = useMotionValue(0);
  const smooth = useSpring(target, SPRING_GLIDE);
  const transform = useTransform(smooth, (value) => `translate3d(0, ${-value * 2}px, 0) scale(${1 + value * 0.04}, ${1 - value * 0.018})`);
  const latest = useRef({ colors, active, speed, reduce });

  useLayoutEffect(() => {
    latest.current = { colors, active, speed, reduce };
    if (reduce) {
      smooth.jump(0);
      target.set(0);
    } else target.set(active ? clampLevel(activity) : 0);
    renderer.current?.requestDraw();
  });

  useEffect(() => smooth.on("change", () => renderer.current?.requestDraw()), [smooth]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    try {
      renderer.current = createOrbRenderer(
        element,
        () => {
          const current = latest.current;
          const moving = current.active && !current.reduce;
          return {
            activity: moving ? clampLevel(smooth.get()) : 0,
            colors: current.colors,
            speed: Number.isFinite(current.speed) ? Math.max(0, current.speed) : 1,
            animated: moving && current.speed > 0,
          };
        },
        () => setFailed(true),
      );
    } catch {
      // No WebGL here: the orb is decoration, so it simply is not drawn.
      queueMicrotask(() => setFailed(true));
    }
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, [smooth]);

  if (failed) return null;
  return (
    <div aria-hidden="true" data-slot="voice-orb" className={cx("sisu-agent-orb", className)}>
      <motion.div className="sisu-agent-orb-body" style={{ transform: reduce ? "none" : transform }}>
        <canvas ref={canvas} className="sisu-agent-orb-canvas" />
      </motion.div>
    </div>
  );
}
