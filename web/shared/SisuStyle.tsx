"use client";
// Small building blocks shared by the screens: the white card, section titles, accessible Rive wrappers and
// the app's motion. Port of ios/Sisu/Shared/SisuStyle.swift. Colours, fonts, spacing and radii come from
// web/theme/tokens.css only. TransientNotice and DataFreshness live in Notice.tsx and DataFreshness.ts.
import type { CSSProperties, ReactNode } from "react";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent, type RiveComponentProps } from "@/web/rive/RiveComponent";
import { SisuSprings } from "@/web/theme/theme";
import { RiveValues } from "./RiveValues";
import "./shared.css";

/** A white card with 24 px corners and a hairline that separates it from the near-white screen. No shadow, no
 *  glass: money figures, charts and lists always sit on this solid surface. Children stack 12 px apart. */
export function SisuCard({ padding, className, style, children }: {
  padding?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const own: CSSProperties = padding === undefined ? {} : { padding };
  return (
    <div className={join("sisu-card sisu-card-surface", className)} style={{ ...own, ...style }}>
      {children}
    </div>
  );
}

/** The card surface class (white, 24 px corners, hairline) for cards not built with SisuCard
 *  (sisuCardSurface(radius:)): `<div className={sisuCardSurface()} />`. Pass a radius to change the corners. */
export function sisuCardSurface(radius?: number): { className: string; style?: CSSProperties } {
  return radius === undefined
    ? { className: "sisu-card-surface" }
    : { className: "sisu-card-surface", style: { borderRadius: radius } };
}

/** A section heading in Bricolage, with an optional line under it. */
export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="sisu-section-title">
      <h2 className="sisu-section-title-text">{title}</h2>
      {detail ? <p className="sisu-section-title-detail">{detail}</p> : null}
    </div>
  );
}

/** A small muted eyebrow above a figure. */
export function Eyebrow({ text }: { text: string }) {
  return <span className="sisu-eyebrow">{text}</span>;
}

/** The accessibility props for a Rive component: one element with a label, and a button when it acts as one.
 *  Spread into RiveComponent: `<RiveComponent {...riveAccessible("Continue", { isButton: true, action })} />`. */
export function riveAccessible(
  label: string,
  options: { isButton?: boolean; value?: string; action?: () => void } = {},
): Pick<RiveComponentProps, "ariaLabel" | "ariaValue" | "isButton" | "onActivate"> {
  return { ariaLabel: label, ariaValue: options.value, isButton: options.isButton ?? false, onActivate: options.action };
}

/** Springy and quick for state changes; calm when Reduce Motion is on. */
export const SisuMotion = {
  /** A CSS transition timing ("481ms linear(...)") for state changes; null (instant) with Reduce Motion. */
  state(reduceMotion: boolean): string | null {
    return reduceMotion ? null : `${SisuSprings.state.durationMs}ms ${SisuSprings.state.easing}`;
  },
  /** How something new comes in: a class that rises it into place, or a plain fade with Reduce Motion. */
  entrance(reduceMotion: boolean): string {
    return reduceMotion ? "sisu-enter-fade" : "sisu-enter-rise";
  },
} as const;

/** The "Sample data" tag. Since 2026-11-14 the demo is disclosed once, at profile selection. Kept for the picker. */
export function SampleDataTag() {
  return (
    <Hug width={RiveHug.sampleTag}>
      <RiveComponent component="Tag" values={RiveValues.tag("Sample data")}
        {...riveAccessible("Sample data. These figures are not live.")} />
    </Hug>
  );
}

/** The primary Rive button with an accessibility label. */
export function SisuButton({ label, style = "primary", enabled = true, loading = false, action, className }: {
  label: string;
  style?: RiveBindings.ButtonStyle;
  enabled?: boolean;
  loading?: boolean;
  action: () => void;
  className?: string;
}) {
  return (
    <RiveComponent
      component="Button"
      className={className}
      values={RiveValues.button(label, style, enabled, loading)}
      onTrigger={(trigger) => { if (trigger === "pressed") action(); }}
      {...riveAccessible(label, { isButton: true, action })}
    />
  );
}

/** Liito, the 2D Rive mascot. */
export function LiitoView({ mood, label, className, style }: {
  mood: string;
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <RiveComponent component="Liito" values={RiveValues.liito(mood)} className={className} style={style}
      {...riveAccessible(label)} />
  );
}

/** The Rive pills and tags hug their text and sit at the leading edge of their artboard, so a frame at the full
 *  design width leaves an empty gap after them. These are the widths they draw at (measured from sisu_ui.riv on
 *  2026-11-14), so they can be laid out tightly. */
export const RiveHug = {
  /** The "Sample data" tag. */
  sampleTag: 92,
  /** A StatPill: icon and padding, plus about 10 px per character of its value. The berries icon is wider. */
  statPill(value: string, kind = "streak"): number {
    const base = kind === "berries" ? 58 : 52;
    return Math.min(base + Math.max(Array.from(value).length - 1, 0) * 10, 96);
  },
} as const;

/** Shows only the leading `width` px of the child at full scale (RiveComponentView.hugging(width:)). */
export function Hug({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div className="sisu-hug" style={{ width: Math.max(width, 1) }}>
      {children}
    </div>
  );
}

/** A round Rive IconButton (48 x 48) with an accessibility label and the button role. */
export function SisuIconButton({ icon, style = "plain", label, action, className }: {
  icon: RiveBindings.IconKind;
  style?: RiveBindings.IconStyle;
  label: string;
  action: () => void;
  className?: string;
}) {
  return (
    <RiveComponent
      component="IconButton"
      className={className}
      values={RiveBindings.iconButton(icon, style)}
      onTrigger={(trigger) => { if (trigger === "pressed") action(); }}
      {...riveAccessible(label, { isButton: true, action })}
    />
  );
}

/** A pressable white card for the light look: hairline border and a 4 px neutral bottom edge that it moves
 *  down onto when pressed (SisuPressableCardStyle). */
export function SisuPressableCard({ onPress, ariaLabel, className, style, disabled, children }: {
  onPress: () => void;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" className={join("sisu-pressable-card", className)} style={style}
      onClick={onPress} aria-label={ariaLabel} disabled={disabled}>
      <span className="sisu-pressable-card-face">{children}</span>
    </button>
  );
}

function join(base: string, extra?: string): string {
  return extra ? `${base} ${extra}` : base;
}
