"use client";
// v2 payday: change the payday and add a bill the history does not show. Used in "Show the maths" on Today and under
// Sisu's payday answer. What is set is kept for this customer (web/app/PaydayStore.ts) and goes with the cash flow
// and every later question, so Today and the chat show the same figure. Nothing here computes a figure.
import { useState } from "react";
import { paydayStore, usePaydayOverrides } from "@/web/app/PaydayStore";
import { PaydayBudget } from "@/web/core/AppLogic/PaydayBudget";
import type { PaydayOverrides } from "@/web/core/CoachModels";
import { Money } from "@/web/core/Presentation";
import "./payday.css";

export function PaydayEditor({ customerId, dataDate, nextPayday, testPrefix }: {
  customerId: string;
  /** The data's "today" (YYYY-MM-DD): dates are checked against it. */
  dataDate: string;
  /** The payday the figure uses now (inferred or confirmed). */
  nextPayday: string | null;
  testPrefix: string;
}) {
  const overrides = usePaydayOverrides(customerId);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = (next: PaydayOverrides) => paydayStore.set(customerId, next);
  const bills = overrides?.extraBills ?? [];
  const min = PaydayBudget.isDate(dataDate) ? new Date(Date.parse(`${dataDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : undefined;
  const max = PaydayBudget.isDate(dataDate) ? new Date(Date.parse(`${dataDate}T00:00:00Z`) + PaydayBudget.maxDaysAhead * 86_400_000).toISOString().slice(0, 10) : undefined;

  const changePayday = (value: string) => {
    const problem = PaydayBudget.paydayError(value, dataDate);
    setError(problem);
    if (!problem) save({ ...overrides, paydayDate: value });
  };
  const addBill = () => {
    const bill = PaydayBudget.bill(label, amount, due, dataDate);
    if (typeof bill === "string") { setError(bill); return; }
    setError(null);
    save({ ...overrides, extraBills: [...bills, bill].slice(0, PaydayBudget.maxBills) });
    setLabel(""); setAmount(""); setDue("");
  };
  const removeBill = (index: number) => save({ ...overrides, extraBills: bills.filter((_, i) => i !== index) });
  const useHistory = () => { setError(null); save({ ...overrides, paydayDate: undefined }); };

  return (
    <div className="sisu-payday-editor" data-testid={`${testPrefix}.payday`}>
      <label className="sisu-payday-row">
        <span className="sisu-payday-label">Payday</span>
        <input type="date" className="sisu-payday-input" value={overrides?.paydayDate ?? nextPayday ?? ""} min={min} max={max}
          onChange={(event) => changePayday(event.target.value)} data-testid={`${testPrefix}.payday.date`} />
      </label>
      <p className="sisu-payday-note">
        {overrides?.paydayDate ? "The date you gave." : "Inferred from your salary history."}
        {overrides?.paydayDate ? (
          <button type="button" className="sisu-payday-link" onClick={useHistory}>Use my salary history</button>
        ) : null}
      </p>
      {bills.length > 0 ? (
        <ul className="sisu-payday-bills">
          {bills.map((bill, index) => (
            <li key={`${bill.label}-${bill.dueDate}-${index}`} className="sisu-payday-bill">
              <span>{`${bill.label} · ${Money.format(bill.amountEur, "en", true)} · due ${PaydayBudget.dayText(bill.dueDate)}`}</span>
              <button type="button" className="sisu-payday-link" onClick={() => removeBill(index)} aria-label={`Remove ${bill.label}`}>Remove</button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="sisu-payday-form" role="group" aria-label="Add a bill">
        <span className="sisu-payday-label">Add a bill</span>
        <input className="sisu-payday-input" value={label} placeholder="What it is" maxLength={40}
          onChange={(event) => setLabel(event.target.value)} data-testid={`${testPrefix}.payday.billLabel`} aria-label="Bill name" />
        <div className="sisu-payday-pair">
          <input className="sisu-payday-input" inputMode="decimal" value={amount} placeholder="€ amount"
            onChange={(event) => setAmount(event.target.value)} data-testid={`${testPrefix}.payday.billAmount`} aria-label="Amount in euros" />
          <input type="date" className="sisu-payday-input" value={due} min={dataDate} max={max}
            onChange={(event) => setDue(event.target.value)} data-testid={`${testPrefix}.payday.billDue`} aria-label="Due date" />
        </div>
        <button type="button" className="sisu-payday-add" onClick={addBill} data-testid={`${testPrefix}.payday.addBill`}>Add bill</button>
      </div>
      {error ? <p className="sisu-payday-error" role="alert">{error}</p> : null}
    </div>
  );
}
