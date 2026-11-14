"use client";

// The three baskets as one bar split in three, with each basket's amount and what is in it underneath.
// One whole, three parts: a split bar shows that more exactly than a ring, and the rows carry every figure.
import { useState } from "react";
import type { Visual } from "@/lib/types";

type Baskets = Extract<Visual, { kind: "basket_bar" }>;
const euro = (value: number): string => `€${Math.round(value).toLocaleString("en-US")}`;
const COLOUR = ["var(--viz-main)", "var(--viz-4)", "var(--viz-1)"];

export function BasketBar({ visual }: { visual: Baskets }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex h-11 w-full gap-0.5" role="img" aria-label={visual.baskets.map((basket) => `${basket.label} ${euro(basket.monthly)}, ${Math.round(basket.share)} percent`).join("; ")}>
        {visual.baskets.map((basket, index) => (
          <div
            key={basket.id}
            className="viz-grow-x flex min-w-0 cursor-default items-center justify-center overflow-hidden first:rounded-l-xl last:rounded-r-xl"
            style={{ width: `${Math.max(4, basket.share)}%`, background: COLOUR[index % COLOUR.length], animationDelay: `${index * 180}ms`, opacity: active === null || active === index ? 1 : 0.35, transition: "opacity 180ms ease" }}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
          >
            {basket.share >= 14 && <span className="tabular text-sm font-semibold text-white">{Math.round(basket.share)}%</span>}
          </div>
        ))}
      </div>
      <ul className="space-y-2">
        {visual.baskets.map((basket, index) => (
          <li key={basket.id} className={`viz-fade rounded-xl px-2 py-1.5 transition-colors ${active === index ? "bg-paper" : ""}`} style={{ animationDelay: `${index * 180 + 200}ms` }} onPointerEnter={() => setActive(index)} onPointerLeave={() => setActive(null)}>
            <p className="flex items-baseline gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-sm" style={{ background: COLOUR[index % COLOUR.length] }} />
              <span className="min-w-0 flex-1 font-medium">{basket.label}</span>
              <span className="tabular shrink-0 text-muted">{Math.round(basket.share)}%</span>
              <span className="tabular w-16 shrink-0 text-right font-semibold">{euro(basket.monthly)}</span>
            </p>
            <p className="mt-0.5 pl-[1.125rem] text-xs leading-snug text-muted">
              {basket.description}
              {basket.top.length > 0 && ` Mostly ${basket.top.map((entry) => `${entry.category} ${euro(entry.monthly)}`).join(", ")}.`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
