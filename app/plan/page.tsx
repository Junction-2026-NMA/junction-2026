"use client";

// "Sort out my money": one tap, and the customer watches Sisu read their account, search the web, do the sums and
// set up a plan, then approves all of it at once. A self-contained page, so it can be shown on its own or its
// parts (Stage, PlanCard, usePlan) lifted into the main app.
import { useEffect, useRef, useState } from "react";
import { fetchDemoCustomers } from "@/lib/api";
import type { DemoCustomer } from "@/lib/types";
import { PlanCard } from "./PlanCard";
import { Stage } from "./Stage";
import "./plan.css";
import { usePlan } from "./usePlan";

// Says the summary aloud once. A failure here is silent on purpose: the words are on screen either way.
async function speak(text: string, player: HTMLAudioElement): Promise<void> {
  try {
    const response = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, format: "mp3" }) });
    if (!response.ok) return;
    player.src = URL.createObjectURL(await response.blob());
    await player.play();
  } catch (error) {
    console.warn("Sisu could not speak the summary:", (error as Error).message);
  }
}

export default function PlanPage() {
  const [customers, setCustomers] = useState<DemoCustomer[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const { view, start, approveAll, decline } = usePlan();
  const player = useRef<HTMLAudioElement | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const spoken = useRef<string | null>(null);

  useEffect(() => {
    fetchDemoCustomers().then((list) => {
      setCustomers(list);
      setCustomerId((current) => current ?? list[0]?.customerId ?? null);
    });
  }, []);

  // When the plan is ready: bring it into view and say it.
  const plan = view.plan;
  useEffect(() => {
    if (!plan || spoken.current === plan.id) return;
    spoken.current = plan.id;
    card.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (sound && player.current) void speak(plan.summary, player.current);
  }, [plan, sound]);

  const run = () => {
    if (!customerId) return;
    player.current?.pause();
    window.scrollTo({ top: 0, behavior: "smooth" });
    void start(customerId);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 px-4 pb-10 pt-4">
      <header className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold tracking-tight">Sisu</p>
        <div className="flex items-center gap-2 text-sm">
          <label className="sr-only" htmlFor="plan-customer">
            Customer
          </label>
          <select id="plan-customer" value={customerId ?? ""} onChange={(event) => setCustomerId(event.target.value)} disabled={view.phase === "running"} className="min-h-9 rounded-full border border-line bg-card px-3">
            {customers.map((customer) => (
              <option key={customer.customerId} value={customer.customerId}>
                {customer.displayName}, {customer.age}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setSound((on) => !on)} aria-pressed={sound} className="min-h-9 rounded-full border border-line bg-card px-3">
            {sound ? "Voice on" : "Voice off"}
          </button>
        </div>
      </header>

      <Stage view={view} onStart={run} canStart={customerId !== null} />

      <div ref={card}>{plan && customerId && <PlanCard view={view} onApprove={() => void approveAll(customerId, view.actions.filter((action) => action.status === "awaiting_approval").map((action) => action.id))} onDecline={decline} onAgain={run} />}</div>

      <audio ref={player} hidden />
    </main>
  );
}
