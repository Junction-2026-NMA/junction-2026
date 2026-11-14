"use client";
// The safe-to-spend hero (Rive HeroNumber) and "Show the maths". A tap on the hero shows the everyday
// payments. Port of HeroBlock in TodayScreen.swift.
import { useAppModel } from "@/web/app/AppProvider";
import type { Overview } from "@/web/core/Models";
import { BasketKind, XrayPresenter } from "@/web/core/Presentation";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { SisuButton, riveAccessible } from "@/web/shared/SisuStyle";
import "./today.css";
import { useTap } from "@/web/shared/useTap";

export function HeroBlock({ overview }: { overview: Overview }) {
  const model = useAppModel();
  // The Rive hero wraps its context line to two lines, so it gets the full sentence.
  const full = XrayPresenter.hero(overview, "en");
  const hero = full;

  const openEveryday = () => {
    const basket = overview.baskets.find((b) => b.id === "everyday");
    if (!basket) return;
    model.showEvidence(`${BasketKind.label(BasketKind.of(basket.id), "en")}: ${basket.label}`,
      { from: overview.windowFrom, to: overview.windowTo, basket: "everyday" });
  };

  // A finger tap on the Rive canvas sends no click (RiveCanvas cancels touchend), so open on the pointer tap.
  const heroTap = useTap(openEveryday);

  return (
    <div className="sisu-today-hero">
      <div className="sisu-today-hero-tap" {...heroTap}>
        <RiveComponent component="HeroNumber" values={RiveValues.hero(hero)} testId="today.hero"
          {...riveAccessible(`${full.eyebrow} ${full.amount} ${full.unit}. ${full.context}`, { isButton: true, action: openEveryday })} />
      </div>
      <SisuButton label="Show the maths" style="quiet" action={() => model.setTodaySheet("maths")} />
    </div>
  );
}
