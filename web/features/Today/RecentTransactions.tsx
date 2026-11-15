"use client";
// The newest payments at the bottom of Today, with "See all" opening the transactions sheet for the whole window.
import { useAppModel } from "@/web/app/AppProvider";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { Overview } from "@/web/core/Models";
import { SisuCard } from "@/web/shared/SisuStyle";
import { ProgressSpinner } from "./Glyphs";
import { useRecentTransactions } from "./todayData";
import "./recent.css";

export function RecentTransactions({ overview }: { overview: Overview }) {
  const model = useAppModel();
  const recent = useRecentTransactions();
  const seeAll = () => model.showEvidence("All transactions", { from: overview.windowFrom, to: overview.windowTo });

  return (
    <section className="sisu-recent" aria-labelledby="today-recent-title" data-testid="today.recent">
      <div className="sisu-recent-head">
        <h2 id="today-recent-title" className="sisu-recent-title">Recent transactions</h2>
        <button type="button" className="sisu-recent-all" onClick={seeAll} data-testid="today.recent.all">See all</button>
      </div>
      <SisuCard>
        {recent.kind === "loading" ? (
          <div className="sisu-recent-message" role="status"><ProgressSpinner /></div>
        ) : recent.kind === "failed" ? (
          <p className="sisu-recent-message">The latest payments did not load. See all tries again.</p>
        ) : recent.value.length === 0 ? (
          <p className="sisu-recent-message">No payments in this period.</p>
        ) : (
          <ul className="sisu-recent-list">
            {recent.value.map((row, index) => {
              const text = TodayPresenter.transactionRow(row);
              const incoming = row.amount > 0;
              return (
                <li key={`${row.date}-${row.time}-${index}`} className="sisu-recent-row">
                  <span className="sisu-recent-main">
                    <span className="sisu-recent-category">{text.category}</span>
                    <span className="sisu-recent-date">{text.date}</span>
                  </span>
                  <span className={incoming ? "sisu-recent-amount sisu-recent-in" : "sisu-recent-amount"}>{text.amount}</span>
                </li>
              );
            })}
          </ul>
        )}
      </SisuCard>
    </section>
  );
}
