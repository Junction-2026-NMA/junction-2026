"use client";
// The floating tab bar: one translucent capsule for Today, Sisu and Path, with a softly green-tinted pill
// under the selected tab that springs to the new tab. Port of ios/Sisu/Shared/GlassTabBar.swift.
// "Liquid glass" is a backdrop-filter capsule; a solid near-white capsule with a hairline when
// prefers-reduced-transparency is on (or the browser has no backdrop-filter, or `solid` is set); with
// prefers-reduced-motion the pill slides without the spring. The bar steps aside while the on-screen keyboard
// is up. Routing stays with the caller (AppModel.tab): this only shows `selection` and reports taps.
import { useReducedMotion, useReducedTransparency } from "@/web/theme/motion";
import { useKeyboardShown } from "./keyboard";
import { TabIcon } from "./TabIcons";
import "./tabbar.css";

/** The three tabs in order, like AppTab.allCases. */
export const defaultTabs = ["today", "sisu", "path"] as const;

export const GlassTabBarTitles = ["Today", "Sisu", "Path"] as const;

export interface GlassTabBarProps<Tab extends string | number> {
  selection: Tab;
  onSelect: (tab: Tab) => void;
  /** The tabs in order (Today, Sisu, Path). Defaults to "today" | "sisu" | "path". */
  tabs?: readonly Tab[];
  /** Hides the bar (it steps aside). Undefined: hidden while the on-screen keyboard is up. */
  hidden?: boolean;
  /** Draws the solid bar, as with reduced transparency (the -sisu.solidBar launch argument). */
  solid?: boolean;
}

export function GlassTabBar<Tab extends string | number>(props: GlassTabBarProps<Tab>) {
  const tabs = (props.tabs ?? (defaultTabs as unknown as readonly Tab[])).slice(0, GlassTabBarTitles.length);
  const reduceMotion = useReducedMotion();
  const reduceTransparency = useReducedTransparency();
  const keyboardShown = useKeyboardShown();
  const hidden = props.hidden ?? keyboardShown;
  const solid = props.solid || reduceTransparency;
  const index = Math.max(tabs.indexOf(props.selection), 0);

  const select = (tab: Tab) => {
    if (tab === props.selection) return;
    selectionHaptic();
    props.onSelect(tab);
  };

  return (
    <nav
      className="sisu-tabbar"
      data-surface={solid ? "solid" : "glass"}
      data-hidden={hidden ? "true" : "false"}
      data-motion={reduceMotion ? "reduced" : "full"}
      aria-label="Tabs"
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      data-testid="tabbar"
    >
      <div className="sisu-tabbar-surface">
        <div className="sisu-tabbar-track" aria-hidden="true">
          <div className="sisu-tabbar-pill" style={{ width: `${100 / Math.max(tabs.length, 1)}%`, transform: `translateX(${index * 100}%)` }} />
        </div>
        <div className="sisu-tabbar-items" role="tablist">
          {tabs.map((tab, position) => {
            const title = GlassTabBarTitles[position] ?? String(tab);
            const selected = position === index;
            return (
              <button
                key={String(tab)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={title}
                className="sisu-tabbar-item"
                data-selected={selected ? "true" : "false"}
                data-testid={`tab.${title.toLowerCase()}`}
                onClick={() => select(tab)}
              >
                <TabIcon index={position} selected={selected} />
                <span className="sisu-tabbar-label">{title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/** The selection haptic (.sensoryFeedback(.selection)): a tick where the browser can vibrate. */
function selectionHaptic() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(8);
  } catch {
    // Not allowed here; the tap still counts.
  }
}
