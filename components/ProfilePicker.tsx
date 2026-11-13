"use client";

import type { DemoCustomer } from "@/lib/types";

type Props = { customers: DemoCustomer[]; onPick: (customerId: string) => void };

export function ProfilePicker({ customers, onPick }: Props) {
  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-16">
      <p className="text-sm font-semibold tracking-[0.2em] text-green">SISU</p>
      <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.05] tracking-tight">
        Your bank knows your past.
        <span className="block text-green">Sisu helps change your future.</span>
      </h1>
      <p className="mt-5 text-base leading-relaxed text-muted">
        Pick a customer to see what Sisu finds in two years of their banking history.
      </p>

      <ul className="mt-8 space-y-3">
        {customers.map((c) => (
          <li key={c.customerId}>
            <button
              type="button"
              onClick={() => onPick(c.customerId)}
              className="flex w-full items-center gap-4 rounded-3xl border border-line bg-card p-4 text-left transition active:scale-[0.99] hover:border-green"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green text-lg font-semibold text-lime">
                {c.displayName[0]}
              </span>
              <span className="flex-1">
                <span className="block text-lg font-semibold">{c.displayName}, {c.age}</span>
                <span className="block text-sm text-muted">{c.area} · {c.postalCode}</span>
              </span>
              <span aria-hidden className="text-xl text-green">→</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-10 text-xs leading-relaxed text-muted">
        Synthetic S-Pankki data from Junction 2026. Names are invented; no real customer is shown.
      </p>
    </div>
  );
}
