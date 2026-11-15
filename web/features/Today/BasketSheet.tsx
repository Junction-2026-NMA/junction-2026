"use client";
// One basket, opened from its button on Today: the monthly amount and its share of spending, what lands in it,
// each category (tap for its payments) with the synthetic-data peer figure labelled as such, and all its payments.
import { useState } from "react";
import { useAppModel } from "@/web/app/AppProvider";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { BasketId, Overview } from "@/web/core/Models";
import { rawOf } from "@/web/core/Presentation";
import { SisuCard } from "@/web/shared/SisuStyle";
import { SheetFrame } from "@/web/features/Sheets/SheetFrame";
import { basketColor } from "./BasketButtons";
import { Chevron } from "./Glyphs";
import "./baskets.css";

export function BasketSheet({ basketId, overview, onClose }: { basketId: BasketId | null; overview: Overview; onClose: () => void }) {
  // Keep the last basket while the sheet slides out.
  const [shown, setShown] = useState<BasketId | null>(basketId);
  if (basketId !== null && basketId !== shown) setShown(basketId);
  const current = basketId ?? shown;
  const basket = current === null ? undefined : overview.baskets.find((b) => rawOf(b.id) === rawOf(current));
  const state = basket ? TodayPresenter.basket(basket, overview.ageBand) : null;

  return (
    <SheetFrame open={basketId !== null && state !== null} onClose={onClose} title={state?.name ?? ""}
      detents={["medium", "large"]} testId="sheet.basket">
      {basket && state ? (
        <BasketContent key={state.id} overview={overview} basketId={basket.id} state={state} onClose={onClose} />
      ) : null}
    </SheetFrame>
  );
}

function BasketContent({ overview, basketId, state, onClose }: {
  overview: Overview;
  basketId: BasketId;
  state: ReturnType<typeof TodayPresenter.basket>;
  onClose: () => void;
}) {
  const model = useAppModel();
  const window = { from: overview.windowFrom, to: overview.windowTo };
  // The payments open over Today; this sheet steps aside so the two never stack.
  const open = (title: string, category: string | null) => {
    onClose();
    model.showEvidence(title, { ...window, category, basket: category === null ? basketId : null });
  };
  const hasPeers = state.categories.some((category) => category.peer !== null);

  return (
    <div className="sisu-basket-sheet">
      <SisuCard>
        <div className="sisu-basket-figure">
          <span className="sisu-baskets-dot" style={{ background: basketColor(state.kind) }} aria-hidden="true" />
          <span className="sisu-basket-amount">{state.monthly}</span>
          <span className="sisu-basket-share">{state.share}</span>
        </div>
        <p className="sisu-basket-about">{state.about}</p>
        <p className="sisu-basket-note">Averaged over the last {overview.windowMonths} months.</p>
      </SisuCard>
      <SisuCard>
        {hasPeers ? <p className="sisu-basket-note" data-testid="basket.peer-note">{TodayPresenter.peerNote}.</p> : null}
        {state.categories.map((category, index) => (
          <div key={category.id} className="sisu-basket-category">
            {index > 0 || hasPeers ? <hr className="sisu-divider" /> : null}
            <button type="button" className="sisu-basket-category-button" onClick={() => open(category.category, category.category)}
              aria-label={`${category.category}, ${category.monthly}. Show the payments`}>
              <span className="sisu-basket-row">
                <span className="sisu-basket-category-name">{category.category}</span>
                <span className="sisu-basket-category-amount">{category.monthly}</span>
                <span className="sisu-baskets-chevron"><Chevron size={12} /></span>
              </span>
              <span className="sisu-basket-reason">{category.reason}</span>
              {category.peer ? <span className="sisu-basket-peer">{category.peer}</span> : null}
            </button>
          </div>
        ))}
      </SisuCard>
      <button type="button" className="sisu-basket-all" onClick={() => open(`${state.name}: all payments`, null)}
        data-testid="basket.all">
        See all the payments
      </button>
    </div>
  );
}
