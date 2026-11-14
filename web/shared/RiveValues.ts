// Property sets for the Rive components, keyed by the names in rive/contract.json.
// Port of ios/Sisu/Shared/RiveValues.swift: where web/core's RiveBindings has a builder it is used; the others
// are built here from the contract.
import { RiveBindings, RiveValue, type RiveValueMap } from "@/web/core/RiveContract";
import type { BasketKind, BasketShares, HeroViewState } from "@/web/core/Presentation";

export const RiveValues = {
  button(label: string, style: RiveBindings.ButtonStyle = "primary", enabled = true, loading = false): RiveValueMap {
    return RiveBindings.button(label, style, enabled, loading);
  },

  hero(state: HeroViewState): RiveValueMap {
    return RiveBindings.heroNumber(state);
  },

  baskets(shares: BasketShares): RiveValueMap {
    return RiveBindings.basketBar(shares);
  },

  chip(kind: BasketKind): RiveValueMap {
    return RiveBindings.basketChip(kind, "en");
  },

  progress(value: number, streak = false): RiveValueMap {
    return RiveBindings.progressBar(value, streak);
  },

  jar(fill: number, label: string): RiveValueMap {
    return RiveBindings.jar(fill, label);
  },

  statPill(kind: string, value: string): RiveValueMap {
    return { kind: RiveValue.enumCase(kind), value: RiveValue.string(value) };
  },

  tag(text: string, tone = "amber"): RiveValueMap {
    return { text: RiveValue.string(text), tone: RiveValue.enumCase(tone) };
  },

  actionRow(title: string, reward: string, done: boolean): RiveValueMap {
    return { title: RiveValue.string(title), reward: RiveValue.string(reward), done: RiveValue.bool(done) };
  },

  choice(label: string, state: string): RiveValueMap {
    return { label: RiveValue.string(label), state: RiveValue.enumCase(state) };
  },

  liito(mood: string): RiveValueMap {
    return { mood: RiveValue.enumCase(mood) };
  },

  tabBar(selected: number): RiveValueMap {
    return {
      selected: RiveValue.number(selected),
      label0: RiveValue.string("Today"),
      label1: RiveValue.string("Ask"),
      label2: RiveValue.string("Jars"),
      label3: RiveValue.string("Path"),
    };
  },

  toggle(on: boolean): RiveValueMap {
    return { on: RiveValue.bool(on) };
  },

  celebration(headline: string, detail: string): RiveValueMap {
    return { headline: RiveValue.string(headline), detail: RiveValue.string(detail) };
  },

  /** The berries pile (`Berries`): `count`. */
  berries(count: number): RiveValueMap {
    return RiveBindings.berries(count);
  },
} as const;
