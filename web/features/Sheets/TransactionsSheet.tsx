"use client";
// The transactions behind a figure: the total, a note when the list is cut, then one row per payment.
// Port of TransactionsSheet in ios/Sisu/Features/Sheets/Sheets.swift (`.sheet(item: $model.evidence)`).
// MainScreen keeps it mounted: it is open while `request` is non-null, and `onClose` sets model.evidence to null.
// The last request's content stays while the sheet slides out. The total stays put above the list (sticky, so the
// sheet's own scroll view and its drag-to-close keep working).
import { useEffect, useState } from "react";
import { useAppModel } from "@/web/app/AppProvider";
import type { EvidenceRequest } from "@/web/app/AppTypes";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import type { TransactionList } from "@/web/core/Models";
import { SisuButton } from "@/web/shared/SisuStyle";
import { ProgressSpinner } from "@/web/features/Today/Glyphs";
import { SheetFrame } from "./SheetFrame";
import "./sheets.css";

type Loaded = { kind: "loading" } | { kind: "failed" } | { kind: "loaded"; list: TransactionList };

export function TransactionsSheet({ request, onClose }: { request: EvidenceRequest | null; onClose: () => void }) {
  const [shown, setShown] = useState<EvidenceRequest | null>(request);
  if (request && request.id !== shown?.id) setShown(request);
  const current = request ?? shown;

  return (
    <SheetFrame open={request !== null} onClose={onClose} title={current?.title ?? ""} detents={["medium", "large"]}
      testId="sheet.transactions">
      {current ? <TransactionsContent key={current.id} request={current} /> : null}
    </SheetFrame>
  );
}

function TransactionsContent({ request }: { request: EvidenceRequest }) {
  const model = useAppModel();
  const [state, setState] = useState<Loaded>({ kind: "loading" });

  const [attempt, setAttempt] = useState(0);

  // `.task { await load() }`: once per request (and per retry), dropped when the sheet goes.
  useEffect(() => {
    let alive = true;
    model.transactions(request.filter).then(
      (list) => { if (alive) setState({ kind: "loaded", list }); },
      // A failed reload keeps a list already shown (Swift shows `list` before `failed`).
      () => { if (alive) setState((previous) => (previous.kind === "loaded" ? previous : { kind: "failed" })); },
    );
    return () => { alive = false; };
  }, [model, request.filter, attempt]);

  // `load()` again: `failed = false` first, so the spinner shows while it tries.
  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((count) => count + 1);
  };

  if (state.kind === "loaded") {
    return state.list.transactions.length === 0
      ? <Message text="No payments in this period." />
      : <Rows list={state.list} />;
  }
  if (state.kind === "failed") {
    return (
      <div className="sisu-tx-state">
        <Message text="The payments could not be loaded." />
        <div className="sisu-tx-retry">
          <SisuButton label="Try again" style="secondary" action={retry} />
        </div>
      </div>
    );
  }
  return (
    <div className="sisu-tx-state sisu-tx-loading" role="status">
      <ProgressSpinner />
      <Message text="Finding the payments" />
    </div>
  );
}

function Rows({ list }: { list: TransactionList }) {
  const note = TodayPresenter.truncatedNote(list);
  const total = TodayPresenter.transactionsTotal(list);
  return (
    <div className="sisu-tx">
      <div className="sisu-tx-summary">
        <p className="sisu-sheet-h3" data-testid="transactions.total">{total.headline}</p>
        {total.detail ? <p className="sisu-sheet-caption">{total.detail}</p> : null}
        {note ? <p className="sisu-sheet-caption">{note}</p> : null}
      </div>
      <ul className="sisu-tx-list sisu-card-surface">
        {list.transactions.map((transaction, index) => {
          const row = TodayPresenter.transactionRow(transaction);
          return (
            <li key={index} className="sisu-tx-item">
              {index > 0 ? <hr className="sisu-sheet-divider" /> : null}
              <div className="sisu-tx-row" aria-label={`${row.category}, ${row.date}, ${row.amount}`} role="group">
                <div className="sisu-tx-row-text">
                  <span className="sisu-sheet-text">{row.category}</span>
                  <span className="sisu-sheet-caption">{row.date}</span>
                </div>
                <span className="sisu-sheet-button-text">{row.amount}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Message({ text }: { text: string }) {
  return <p className="sisu-tx-message">{text}</p>;
}
