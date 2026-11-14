"use client";
// Liito and one friendly sentence, for a tab with nothing to show yet. Port of PlaceholderScreen in
// AskScreen.swift (Ask shows it before a profile is chosen).
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { riveAccessible } from "@/web/shared/SisuStyle";
import "./ask.css";

export function PlaceholderScreen({ title, mood, line, testId }: { title: string; mood: string; line: string; testId?: string }) {
  return (
    <div className="sisu-ask-placeholder" data-testid={testId}>
      <h1 className="sisu-ask-title">{title}</h1>
      <div className="sisu-ask-placeholder-spacer" />
      <div className="sisu-ask-placeholder-liito">
        <RiveComponent component="Liito" values={RiveValues.liito(mood)} sizing="contain" style={{ width: 240, height: 240 }}
          {...riveAccessible("Liito the flying squirrel")} />
      </div>
      <p className="sisu-ask-placeholder-line">{line}</p>
      <div className="sisu-ask-placeholder-spacer" />
    </div>
  );
}
