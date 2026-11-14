"use client";
// "Where your money goes": the Rive baskets illustration, its legend, and one card per basket whose figures
// open the transactions behind them. Port of BasketsSection, LegendDot and BasketCard in TodaySections.swift.
import { useId } from "react";
import { useAppModel } from "@/web/app/AppProvider";
import { TodayPresenter, type BasketCardState } from "@/web/core/AppLogic/AppPresenters";
import type { Overview } from "@/web/core/Models";
import { BasketMath, type BasketKind } from "@/web/core/Presentation";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { SectionTitle, SisuCard, riveAccessible } from "@/web/shared/SisuStyle";
import { Chevron } from "./Glyphs";
import "./today.css";

/** The basket's colour from the brand ramp, for the legend dots (BasketsSection.color). */
export function basketColor(kind: BasketKind): string {
  switch (kind) {
    case "fixed": return "var(--sisu-color-basket-fixed)";
    case "curveballs": return "var(--sisu-color-basket-curveballs)";
    case "leaks": return "var(--sisu-color-basket-leaks)";
    case "jars": return "var(--sisu-color-basket-jars)";
  }
}

export function BasketsSection({ overview }: { overview: Overview }) {
  const model = useAppModel();
  const legend = TodayPresenter.basketLegendItems(overview);

  return (
    <section className="sisu-today-section">
      <SectionTitle title="Where your money goes"
        detail={`Three baskets, averaged over your last ${overview.windowMonths} months.`} />
      <div className="sisu-today-baskets-art" role="img"
        aria-label={`Your spending by basket: ${legend.map((item) => item.text).join(", ")}`}>
        {/* The illustration leaves an empty band above the baskets' handles: pull it up under the subtitle. */}
        <RiveComponent component="Baskets" className="sisu-today-baskets-rive"
          values={RiveBindings.baskets(BasketMath.shares(overview))} />
        <div className="sisu-today-legend" aria-hidden="true">
          {legend.map((item) => (
            <div key={item.kind} className="sisu-today-legend-item">
              <LegendDot kind={item.kind} />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
      {overview.baskets.map((basket) => (
        <BasketCard key={basket.id} state={TodayPresenter.basket(basket, overview.peerCount)}
          open={(title, category) => model.showEvidence(title, {
            from: overview.windowFrom, to: overview.windowTo,
            category, basket: category === null ? basket.id : null,
          })} />
      ))}
    </section>
  );
}

/** A legend dot in the basket's green; the savings jar is mint with an S green ring. */
function LegendDot({ kind }: { kind: BasketKind }) {
  return (
    <span className={kind === "jars" ? "sisu-today-dot sisu-today-dot-jars" : "sisu-today-dot"}
      style={{ background: basketColor(kind) }} />
  );
}

function BasketCard({ state, open }: {
  state: BasketCardState;
  /** Opens transactions: a title, and a category (null for the whole basket). */
  open: (title: string, category: string | null) => void;
}) {
  const hint = useId();
  return (
    <SisuCard>
      <span id={hint} hidden>Shows the transactions</span>
      <RiveComponent component="BasketChip" values={RiveValues.chip(state.kind)}
        {...riveAccessible(`${state.name} basket`)} />
      <button type="button" className="sisu-today-plain-button sisu-today-basket-figure"
        onClick={() => open(`${state.name}: ${state.subtitle}`, null)}
        aria-label={`${state.name}, ${state.monthly}, ${state.share}. Show transactions`}>
        <span className="sisu-today-label-muted">{state.subtitle}</span>
        <span className="sisu-today-baseline-row">
          <span className="sisu-today-h2">{state.monthly}</span>
          <span className="sisu-today-label-green">{state.share}</span>
        </span>
      </button>
      {state.categories.map((category) => (
        <div key={category.id} className="sisu-today-category">
          <hr className="sisu-divider" />
          <button type="button" className="sisu-today-plain-button sisu-today-category-button"
            onClick={() => open(category.category, category.category)}
            aria-describedby={hint}>
            <span className="sisu-today-baseline-row">
              <span className="sisu-today-button-text sisu-today-grow">{category.category}</span>
              <span className="sisu-today-button-text">{category.monthly}</span>
              <span className="sisu-today-chevron-green"><Chevron size={12} /></span>
            </span>
            <span className="sisu-today-label-muted">{category.reason}</span>
            {category.peer ? <span className="sisu-today-caption-green">{category.peer}</span> : null}
          </button>
        </div>
      ))}
    </SisuCard>
  );
}
