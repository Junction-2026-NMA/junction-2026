// The Rive contract as the web Rive layer needs it, read straight from rive/contract.json.
// Web side of ios/Sisu/Rive/RiveComponentContract.swift (and the parts of SisuCore's RiveContract.swift the
// view layer uses: component names, design size, sizing, in and out triggers).
import contractJson from "@/rive/contract.json";
import type { RiveComponent as CoreRiveComponent, RiveSizing as CoreRiveSizing } from "@/web/core/RiveContract";

/** How a component is sized by its parent. */
export type RiveSizing = CoreRiveSizing;

/** The Rive files the app ships. The file name without `.riv`. */
export type RiveFileName = "sisu_ui";

/** Where each file is served from (public/rive). */
export const riveFileURL: Record<RiveFileName, string> = {
  sisu_ui: "/rive/sisu_ui.riv",
};

/** Every artboard in rive/contract.json. The value is the artboard name. */
export const RiveComponents = {
  button: "Button",
  heroNumber: "HeroNumber",
  basketBar: "BasketBar",
  basketChip: "BasketChip",
  progressBar: "ProgressBar",
  statPill: "StatPill",
  tabBar: "TabBar",
  actionRow: "ActionRow",
  choiceCard: "ChoiceCard",
  voiceButton: "VoiceButton",
  stageIndicator: "StageIndicator",
  liito: "Liito",
  jar: "Jar",
  celebration: "Celebration",
  sticker: "Sticker",
  toggle: "Toggle",
  tag: "Tag",
  baskets: "Baskets",
  berries: "Berries",
  iconButton: "IconButton",
  lessonNode: "LessonNode",
  typingDots: "TypingDots",
} as const satisfies Record<string, CoreRiveComponent>;

/** An artboard name, for example "Button". The same type as web/core's `RiveComponent`. */
export type RiveComponentName = CoreRiveComponent;

export type RivePropertyType = "string" | "number" | "boolean" | "enum" | "trigger";
export type RiveDirection = "in" | "out" | "inout";

export interface RiveContractProperty {
  name: string;
  type: RivePropertyType;
  direction: RiveDirection;
  default?: string | number | boolean;
  enum?: string;
}

/** What the app needs to know about one Rive component. */
export interface RiveComponentContract {
  name: RiveComponentName;
  file: RiveFileName;
  designSize: { width: number; height: number };
  sizing: RiveSizing;
  /** Trigger properties the file fires and the app listens to (direction out), in contract order. */
  outTriggers: string[];
  /** Trigger properties the app may fire (direction in), in contract order. */
  inTriggers: string[];
  properties: RiveContractProperty[];
  purpose: string;
}

interface JsonArtboard {
  name: string;
  size: number[];
  sizing: string;
  purpose?: string;
  properties: { name: string; type: string; direction: string; default?: unknown; enum?: string }[];
}

interface JsonContract {
  enums: Record<string, string[]>;
  files: Record<string, { artboards: JsonArtboard[] }>;
}

const json = contractJson as unknown as JsonContract;

function toContract(file: string, artboard: JsonArtboard): RiveComponentContract {
  const properties = artboard.properties.map((p) => ({
    name: p.name,
    type: p.type as RivePropertyType,
    direction: p.direction as RiveDirection,
    default: p.default as string | number | boolean | undefined,
    enum: p.enum,
  }));
  const triggers = (direction: RiveDirection) =>
    properties.filter((p) => p.type === "trigger" && p.direction === direction).map((p) => p.name);
  return {
    name: artboard.name as RiveComponentName,
    file: file as RiveFileName,
    designSize: { width: artboard.size[0] ?? 0, height: artboard.size[1] ?? 0 },
    sizing: artboard.sizing as RiveSizing,
    outTriggers: triggers("out"),
    inTriggers: triggers("in"),
    properties,
    purpose: artboard.purpose ?? "",
  };
}

const contracts: RiveComponentContract[] = Object.entries(json.files).flatMap(([file, entry]) =>
  entry.artboards.map((artboard) => toContract(file, artboard)),
);

const byName = new Map(contracts.map((contract) => [contract.name, contract]));

/** Every component of the contract, in contract order. */
export const allRiveContracts: readonly RiveComponentContract[] = contracts;

/** The enums of the contract by name (ButtonStyle, Basket, ...), each case in order. */
export const riveEnums: Readonly<Record<string, readonly string[]>> = json.enums;

/** The contract of one component. Undefined for a name the contract does not have. */
export function riveContract(name: string): RiveComponentContract | undefined {
  return byName.get(name as RiveComponentName);
}
