"use client";
// The three spending baskets as compact buttons: names only. The amount, the share, the categories and the
// transactions open in a sheet on tap (BasketSheet), so Today stays a glance.
import type { BasketId, Overview } from "@/web/core/Models";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { BasketKind } from "@/web/core/Presentation";
import { Chevron } from "./Glyphs";
import "./baskets.css";

/** The basket's colour from the brand ramp. */
export function basketColor(kind: BasketKind): string {
  switch (kind) {
    case "fixed": return "var(--sisu-color-basket-fixed)";
    case "curveballs": return "var(--sisu-color-basket-curveballs)";
    case "leaks": return "var(--sisu-color-basket-leaks)";
  }
}

export function BasketButtons({ overview, onOpen }: { overview: Overview; onOpen: (id: BasketId) => void }) {
  return (
    <section className="sisu-baskets" aria-labelledby="today-baskets-title">
      <div className="sisu-baskets-head">
        <h2 id="today-baskets-title" className="sisu-baskets-title">Your spending</h2>
        <p className="sisu-baskets-detail">Three baskets. Tap one to see what is in it.</p>
      </div>
      <div className="sisu-baskets-row">
        {TodayPresenter.basketButtons(overview).map((basket) => (
          <button key={basket.id} type="button" className="sisu-baskets-button" onClick={() => onOpen(basket.id)}
            data-testid={`today.basket.${basket.id}`} aria-label={`${basket.name}. Show the amounts and payments`}>
            <span className="sisu-baskets-top" aria-hidden="true">
              <span className="sisu-baskets-dot" style={{ background: basketColor(basket.kind) }} />
              <span className="sisu-baskets-chevron"><Chevron size={12} /></span>
            </span>
            <span className="sisu-baskets-name">{basket.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
