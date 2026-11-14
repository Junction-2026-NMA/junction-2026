"use client";
// The app's slider: a 14 px rounded pale-mint track, a deep green fill, and a white knob with a deep green ring
// and the 4 px darker edge of anything pressable. Port of SisuSlider in ios/Sisu/Features/Jars/JarsScreen.swift.
// A touch anywhere on it moves the knob there (DragGesture with minimumDistance 0); vertical drags still scroll.
// Adjustable with the arrow keys and assistive technology (role="slider").
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { roundAway } from "@/web/core/Presentation";

const KNOB = 30;

export interface SisuSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** accessibilityLabel */
  label: string;
  /** accessibilityValue */
  valueText: string;
}

export function SisuSlider({ value, onChange, min, max, step, label, valueText }: SisuSliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const span = Math.max(max - min, step);
  const fraction = (Math.min(Math.max(value, min), max) - min) / span;

  const moveTo = (clientX: number) => {
    const element = ref.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const width = Math.max(box.width - KNOB, 1);
    const raw = ((clientX - box.left - KNOB / 2) / width) * span + min;
    const stepped = roundAway(raw / step) * step;
    const next = Math.min(Math.max(stepped, min), max);
    if (next !== value) onChange(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event.clientX);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const up = event.key === "ArrowRight" || event.key === "ArrowUp";
    const down = event.key === "ArrowLeft" || event.key === "ArrowDown";
    if (!up && !down) return;
    event.preventDefault();
    onChange(up ? Math.min(value + step, max) : Math.max(value - step, min));
  };

  return (
    <div
      ref={ref}
      className="sisu-slider"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <div className="sisu-slider-track" />
      <div className="sisu-slider-fill" style={{ width: `calc(${KNOB / 2}px + (100% - ${KNOB}px) * ${fraction})` }} />
      <div className="sisu-slider-knob" style={{ left: `calc((100% - ${KNOB}px) * ${fraction})` }} />
    </div>
  );
}

/** A slider with its title and its value text above it (SliderRow). */
export function SliderRow({ title, value, onChange, min, max, step, text }: {
  title: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  text: string;
}) {
  return (
    <div className="sisu-jars-slider-row">
      <div className="sisu-jars-slider-head">
        <span className="sisu-jars-slider-title">{title}</span>
        <span className="sisu-jars-slider-value">{text}</span>
      </div>
      <SisuSlider value={value} onChange={onChange} min={min} max={max} step={step} label={title} valueText={text} />
    </div>
  );
}
