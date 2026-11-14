"use client";

// A gallery of every chart Sisu can draw, for one customer. For the team: see them all, then lift VisualCard into the app.
import { useEffect, useState } from "react";
import { fetchDemoCustomers } from "@/lib/api";
import type { DemoCustomer, Visual } from "@/lib/types";
import { VisualCard } from "./VisualCard";

export default function VisualsGallery() {
  const [customers, setCustomers] = useState<DemoCustomer[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [visuals, setVisuals] = useState<Visual[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDemoCustomers().then((list) => {
      setCustomers(list);
      setCustomerId((current) => current ?? list[0]?.customerId ?? null);
    });
  }, []);

  useEffect(() => {
    if (!customerId) return;
    let live = true;
    fetch(`/api/agent/visuals?customerId=${customerId}`)
      .then((response) => response.json() as Promise<{ visuals?: Visual[]; error?: string }>)
      .then((body) => {
        if (!live) return;
        setVisuals(body.visuals ?? []);
        setError(body.error ?? null);
      })
      .catch(() => live && setError("The charts could not be loaded."));
    return () => {
      live = false;
    };
  }, [customerId]);

  return (
    <main className="mx-auto w-full max-w-[430px] space-y-4 px-4 pb-10 pt-4">
      <header className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold tracking-tight">Sisu · charts</p>
        <select aria-label="Customer" value={customerId ?? ""} onChange={(event) => setCustomerId(event.target.value)} className="min-h-9 rounded-full border border-line bg-card px-3 text-sm">
          {customers.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.displayName}, {customer.age}</option>)}
        </select>
      </header>
      {error && <p className="rounded-xl bg-coral/10 p-3 text-sm text-coral">{error}</p>}
      {visuals.map((visual) => <VisualCard key={`${customerId}:${visual.id}`} visual={visual} />)}
    </main>
  );
}
