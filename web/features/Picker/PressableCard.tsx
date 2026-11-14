"use client";
// Port of PressableCardStyle (ios/Sisu/Features/Picker/PickerScreen.swift): a white card with a 4 px green-300
// bottom edge; the face moves down onto it while pressed, with SisuMotion.state (instant with Reduce Motion, via
// the state tokens). The profile cards use it. Pressed is tracked with pointer events, so it also shows on iOS
// Safari (where :active needs a touch handler) and lets go when a drag turns into a scroll (pointercancel).
import { useState, type CSSProperties, type ReactNode } from "react";
import "./picker.css";

export function PressableCard({ onPress, ariaLabel, ariaDescribedBy, ariaPressed, className, style, children }: {
  onPress: () => void;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaPressed?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);
  return (
    <button
      type="button"
      className={className ? `sisu-press-card ${className}` : "sisu-press-card"}
      style={style}
      data-pressed={pressed ? "true" : "false"}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-pressed={ariaPressed}
      onClick={onPress}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onBlur={release}
    >
      <span className="sisu-press-card-face">{children}</span>
    </button>
  );
}
