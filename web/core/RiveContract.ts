/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums and nested types (see web/README.md). */
// Port of SisuCore/RiveContract.swift: the TypeScript side of `rive/contract.json`, which Rive components exist
// and how view state maps to their view model properties. Pure data, testable without the Rive runtime.
// Sizes, sizing and triggers are read from rive/contract.json itself (the Swift file hard-codes the same table;
// web/core/__checks__/core-b.check.ts asserts the two agree).
import contract from "@/rive/contract.json";
import { BasketKind } from "@/web/core/Presentation";
import type { BasketShares, HeroViewState, SisuLanguage } from "@/web/core/Presentation";

// MARK: - The contract file

export interface RiveContractProperty {
  name: string;
  type: "string" | "number" | "boolean" | "enum" | "trigger" | string;
  direction: "in" | "out" | "inout" | string;
  default?: string | number | boolean;
  enum?: string;
  range?: number[];
  meaning?: string;
}

export interface RiveContractArtboard {
  name: string;
  size: number[];
  sizing: string;
  purpose: string;
  properties: RiveContractProperty[];
}

const artboards: RiveContractArtboard[] = (contract.files.sisu_ui.artboards as unknown as RiveContractArtboard[]);
const byName = new Map(artboards.map((artboard) => [artboard.name, artboard]));

/** The enums of `rive/contract.json`, by name (`ButtonStyle`, `LiitoMood`…). */
export const riveContractEnums: Readonly<Record<string, readonly string[]>> = contract.enums;

// MARK: - Files, values, sizing

/** The Rive file the app ships: every interface component, in 2D. No scripts, loads unsigned. */
export type RiveFile = "sisu_ui";
export namespace RiveFile {
  export const ui: RiveFile = "sisu_ui";
  export const allCases: readonly RiveFile[] = ["sisu_ui"];
  /** Where the web serves it: the same file as ios/Sisu/Resources/Rive/sisu_ui.riv, copied to public/rive. */
  export function url(file: RiveFile): string { return `/rive/${file}.riv`; }
}

/** A value written to a view model property. `enumCase` is the name of an enum case, exactly as in the contract. */
export type RiveValue =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "bool"; value: boolean }
  | { kind: "enumCase"; value: string };
export namespace RiveValue {
  export const string = (value: string): RiveValue => ({ kind: "string", value });
  export const number = (value: number): RiveValue => ({ kind: "number", value });
  export const bool = (value: boolean): RiveValue => ({ kind: "bool", value });
  export const enumCase = (value: string): RiveValue => ({ kind: "enumCase", value });
  export function equals(a: RiveValue, b: RiveValue): boolean { return a.kind === b.kind && a.value === b.value; }
}

/** Swift `[String: RiveValue]`: property name to value. */
export type RiveValueMap = Record<string, RiveValue>;

/** How a component is sized by its parent. */
export type RiveSizing =
  /** Use the design size as is. */
  | "fixed"
  /** Fill the available width, keep the design height. */
  | "flexibleWidth"
  /** Scale to fit inside the frame, keeping the aspect ratio. */
  | "contain"
  /** Fill the whole frame. */
  | "fill";

/** The stages of live research, in order (the `ResearchStage` enum of the contract). */
export type ResearchStage = "searching" | "reading" | "comparing" | "done";
export namespace ResearchStage {
  export const allCases: readonly ResearchStage[] = ["searching", "reading", "comparing", "done"];
}

// MARK: - Components

/** Every artboard in `rive/contract.json`. The value is the artboard name. */
export type RiveComponent =
  | "Button" | "HeroNumber" | "BasketBar" | "BasketChip" | "ProgressBar" | "StatPill" | "TabBar" | "ActionRow" | "ChoiceCard"
  | "VoiceButton" | "StageIndicator" | "Liito" | "Jar" | "Celebration" | "Sticker" | "Toggle" | "Tag" | "Baskets" | "Berries"
  | "IconButton" | "LessonNode" | "TypingDots";

export namespace RiveComponent {
  export const button: RiveComponent = "Button";
  export const heroNumber: RiveComponent = "HeroNumber";
  export const basketBar: RiveComponent = "BasketBar";
  export const basketChip: RiveComponent = "BasketChip";
  export const progressBar: RiveComponent = "ProgressBar";
  export const statPill: RiveComponent = "StatPill";
  export const tabBar: RiveComponent = "TabBar";
  export const actionRow: RiveComponent = "ActionRow";
  export const choiceCard: RiveComponent = "ChoiceCard";
  export const voiceButton: RiveComponent = "VoiceButton";
  export const stageIndicator: RiveComponent = "StageIndicator";
  export const liito: RiveComponent = "Liito";
  export const jar: RiveComponent = "Jar";
  export const celebration: RiveComponent = "Celebration";
  export const sticker: RiveComponent = "Sticker";
  export const toggle: RiveComponent = "Toggle";
  export const tag: RiveComponent = "Tag";
  export const baskets: RiveComponent = "Baskets";
  export const berries: RiveComponent = "Berries";
  export const iconButton: RiveComponent = "IconButton";
  export const lessonNode: RiveComponent = "LessonNode";
  export const typingDots: RiveComponent = "TypingDots";

  /** Every component, in Swift's case order (which is the contract's artboard order). */
  export const allCases: readonly RiveComponent[] = [
    "Button", "HeroNumber", "BasketBar", "BasketChip", "ProgressBar", "StatPill", "TabBar", "ActionRow", "ChoiceCard", "VoiceButton",
    "StageIndicator", "Liito", "Jar", "Celebration", "Sticker", "Toggle", "Tag", "Baskets", "Berries", "IconButton", "LessonNode", "TypingDots",
  ];

  /** Swift `RiveComponent(rawValue:)`. */
  export function fromRawValue(name: string): RiveComponent | null {
    return (allCases as readonly string[]).includes(name) ? (name as RiveComponent) : null;
  }

  /** The contract entry of the artboard. */
  export function artboard(component: RiveComponent): RiveContractArtboard {
    const entry = byName.get(component);
    if (!entry) throw new Error(`rive/contract.json has no artboard ${component}`);
    return entry;
  }

  /** The file the artboard lives in: always `sisu_ui`. */
  export function file(_component: RiveComponent): RiveFile { return RiveFile.ui; }

  /** Every artboard has one state machine named Main. */
  export const stateMachine = "Main";

  /** Every artboard has its own view model named `<Artboard>VM` with a default instance. */
  export function viewModelName(component: RiveComponent): string { return `${component}VM`; }

  /** The design size in points, exactly as `size` in the contract. */
  export function designSize(component: RiveComponent): { width: number; height: number } {
    const [width, height] = artboard(component).size;
    return { width, height };
  }

  /** Exactly as `sizing` in the contract. */
  export function sizing(component: RiveComponent): RiveSizing { return artboard(component).sizing as RiveSizing; }

  /** The view model properties, in contract order. Names starting with `_` belong to the file and are left out. */
  export function properties(component: RiveComponent): RiveContractProperty[] {
    return artboard(component).properties.filter((property) => !property.name.startsWith("_"));
  }

  /** The trigger properties the Rive file fires and the app listens to (direction `out`), in contract order. */
  export function outTriggers(component: RiveComponent): string[] {
    return properties(component).filter((p) => p.type === "trigger" && p.direction === "out").map((p) => p.name);
  }

  /** The trigger properties the app may fire (direction `in`), in contract order. */
  export function inTriggers(component: RiveComponent): string[] {
    return properties(component).filter((p) => p.type === "trigger" && p.direction === "in").map((p) => p.name);
  }
}

// MARK: - Bindings

/**
 * Builds the property values for a component from view state. Keys are the property names in the contract;
 * every `in` property of the component that is not a trigger gets a value. Numbers outside a property's range
 * are clamped to it, and a number that is not finite counts as 0.
 */
export namespace RiveBindings {
  export type ButtonStyle = "primary" | "secondary" | "onDark" | "quiet";
  export type ChoiceState = "idle" | "selected" | "correct" | "wrong";
  export type VoiceState = "idle" | "recording" | "thinking" | "speaking";
  export type LiitoMood = "idle" | "cheering" | "proud" | "gliding" | "curious" | "found" | "focused" | "cosy" | "sleepy" | "thinking";
  export type StatKind = "streak" | "berries";
  export type TagTone = "neutral" | "amber" | "info";
  export type StickerKind = "firstJar" | "leakPlugged" | "streak" | "lesson";
  export type IconKind = "settings" | "close" | "back" | "forward" | "info" | "soundOn" | "soundOff" | "more";
  export type IconStyle = "plain" | "tinted" | "filled";
  export type LessonState = "upcoming" | "current" | "done";

  /** `allCases` of each Swift enum above, in case order. */
  export const ButtonStyleCases: readonly ButtonStyle[] = ["primary", "secondary", "onDark", "quiet"];
  export const ChoiceStateCases: readonly ChoiceState[] = ["idle", "selected", "correct", "wrong"];
  export const VoiceStateCases: readonly VoiceState[] = ["idle", "recording", "thinking", "speaking"];
  export const LiitoMoodCases: readonly LiitoMood[] = ["idle", "cheering", "proud", "gliding", "curious", "found", "focused", "cosy", "sleepy", "thinking"];
  export const StatKindCases: readonly StatKind[] = ["streak", "berries"];
  export const TagToneCases: readonly TagTone[] = ["neutral", "amber", "info"];
  export const StickerKindCases: readonly StickerKind[] = ["firstJar", "leakPlugged", "streak", "lesson"];
  export const IconKindCases: readonly IconKind[] = ["settings", "close", "back", "forward", "info", "soundOn", "soundOff", "more"];
  export const IconStyleCases: readonly IconStyle[] = ["plain", "tinted", "filled"];
  export const LessonStateCases: readonly LessonState[] = ["upcoming", "current", "done"];

  /** The tab labels of the contract's defaults: Today, Ask, Jars, Path. */
  export const defaultTabLabels = ["Today", "Ask", "Jars", "Path"];

  const s = RiveValue.string, n = RiveValue.number, b = RiveValue.bool, e = RiveValue.enumCase;

  /** A finite value clamped to `range`; a value that is not finite counts as 0 (then clamped). */
  export function clamp(value: number, range: [number, number] = [0, 1]): number {
    const finite = Number.isFinite(value) ? value : 0;
    return Math.min(Math.max(finite, range[0]), range[1]);
  }

  /** `label`, `style`, `enabled`, `loading`. */
  export function button(label: string, style: ButtonStyle = "primary", enabled = true, loading = false): RiveValueMap {
    return { label: s(label), style: e(style), enabled: b(enabled), loading: b(loading) };
  }

  /** `eyebrow`, `amount`, `unit`, `context`. */
  export function heroNumber(state: HeroViewState): RiveValueMap {
    return { eyebrow: s(state.eyebrow), amount: s(state.amount), unit: s(state.unit), context: s(state.context) };
  }

  /** `fixed`, `curveballs`, `leaks`, `jars` as numbers 0...1. For `BasketBar` and `Baskets`. */
  export function basketBar(shares: BasketShares): RiveValueMap {
    return { fixed: n(clamp(shares.fixed)), curveballs: n(clamp(shares.curveballs)), leaks: n(clamp(shares.leaks)), jars: n(clamp(shares.jars)) };
  }

  /** `basket` (the kind as an enum case) and `label`. */
  export function basketChip(kind: BasketKind, language: SisuLanguage): RiveValueMap {
    return { basket: e(kind), label: s(BasketKind.label(kind, language)) };
  }

  /** `progress` clamped to 0...1 and `tone` (`green` or `streak`). */
  export function progressBar(progress: number, streak = false): RiveValueMap {
    return { progress: n(clamp(progress)), tone: e(streak ? "streak" : "green") };
  }

  /** The label the stage indicator shows. */
  export function stageLabel(stage: ResearchStage, language: SisuLanguage): string {
    const en = { searching: "Searching for current offers", reading: "Reading the pages", comparing: "Comparing with your bill", done: "Done" };
    const fi = { searching: "Etsitään tämänhetkisiä tarjouksia", reading: "Luetaan sivuja", comparing: "Verrataan laskuusi", done: "Valmis" };
    return (language === "en" ? en : fi)[stage];
  }

  /** `stage` (as an enum case) and `label`. */
  export function stageIndicator(stage: ResearchStage, language: SisuLanguage): RiveValueMap {
    return { stage: e(stage), label: s(stageLabel(stage, language)) };
  }

  /** `fill` clamped to 0...1, `label`, and `full` (true when `fill` is 1 or more; false for a non-finite fill). */
  export function jar(fill: number, label: string): RiveValueMap {
    const finite = Number.isFinite(fill) ? fill : 0;
    return { fill: n(clamp(finite)), label: s(label), full: b(finite >= 1) };
  }

  /** `selected` (the tab index clamped to 0...3) and `label0`…`label3`; a missing label falls back to the default. */
  export function tabBar(selected: number, labels: string[] = defaultTabLabels): RiveValueMap {
    const values: RiveValueMap = { selected: n(Math.min(Math.max(Math.trunc(selected) || 0, 0), 3)) };
    return [0, 1, 2, 3].reduce((all, index) => ({ ...all, [`label${index}`]: s(index < labels.length ? labels[index] : defaultTabLabels[index]) }), values);
  }

  /** `title`, `reward`, `done`. */
  export function actionRow(title: string, reward = "", done = false): RiveValueMap {
    return { title: s(title), reward: s(reward), done: b(done) };
  }

  /** `label` and `state`. */
  export function choiceCard(label: string, state: ChoiceState = "idle"): RiveValueMap {
    return { label: s(label), state: e(state) };
  }

  /** `state`. */
  export function voiceButton(state: VoiceState): RiveValueMap { return { state: e(state) }; }

  /** `mood`. For `Liito`. */
  export function liito(mood: LiitoMood): RiveValueMap { return { mood: e(mood) }; }

  /** `kind` and `value` (the text in the pill, for example `12`). */
  export function statPill(kind: StatKind, value: string): RiveValueMap { return { kind: e(kind), value: s(value) }; }

  /** `text` and `tone`. */
  export function tag(text: string, tone: TagTone = "neutral"): RiveValueMap { return { text: s(text), tone: e(tone) }; }

  /** `on`. */
  export function toggle(on: boolean): RiveValueMap { return { on: b(on) }; }

  /** `kind` and `label`. */
  export function sticker(kind: StickerKind, label: string): RiveValueMap { return { kind: e(kind), label: s(label) }; }

  /** `headline` and `detail`. */
  export function celebration(headline: string, detail: string): RiveValueMap { return { headline: s(headline), detail: s(detail) }; }

  /** The same set as `basketBar`, for the `Baskets` illustration. */
  export function baskets(shares: BasketShares): RiveValueMap { return basketBar(shares); }

  /** `icon`, `style`, `enabled`. For `IconButton`. */
  export function iconButton(icon: IconKind, style: IconStyle = "plain", enabled = true): RiveValueMap {
    return { icon: e(icon), style: e(style), enabled: b(enabled) };
  }

  /** `state` and `number` (the text on the node, for example `1`). For `LessonNode`. */
  export function lessonNode(state: LessonState, number: string): RiveValueMap { return { state: e(state), number: s(number) }; }

  /** `active`. For `TypingDots`. */
  export function typingDots(active = true): RiveValueMap { return { active: b(active) }; }

  /** `count` for `Berries`, clamped to 0...60 (a value that is not finite counts as 0). */
  export function berries(count: number): RiveValueMap { return { count: n(clamp(count, [0, 60])) }; }
}

export type ButtonStyle = RiveBindings.ButtonStyle;
export type ChoiceState = RiveBindings.ChoiceState;
export type VoiceState = RiveBindings.VoiceState;
export type LiitoMood = RiveBindings.LiitoMood;
export type StatKind = RiveBindings.StatKind;
export type TagTone = RiveBindings.TagTone;
export type StickerKind = RiveBindings.StickerKind;
export type IconKind = RiveBindings.IconKind;
export type IconStyle = RiveBindings.IconStyle;
export type LessonState = RiveBindings.LessonState;
