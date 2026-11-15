import { fact } from "@/lib/finance/facts";
import { round2 } from "@/lib/finance/math";
import { currentHousing } from "@/lib/finance/rent";
import { listNotifications, listWatches } from "@/lib/watch";
import { outcome, type ToolContext, type ToolOutcome } from "./types";

export function getRentBudget(ctx: ToolContext): ToolOutcome {
  const o = ctx.overview;
  const housing = currentHousing(o);
  const gap = round2(o.safeToSpend.gapPerMonth);
  const ceiling = Math.max(0, round2(housing + gap));
  const facts = [
    fact("rent-budget:current", "Housing today per month", housing, "EUR/month", "Housing payments, last twelve months", { evidence: { from: o.windowFrom, to: o.windowTo, category: "Housing" } }),
    fact("rent-budget:gap", "Monthly surplus at current spending", gap, "EUR/month", "average income minus essentials, saving and everyday spending", { source: "calculation" }),
    fact("rent-budget:ceiling", "Break-even rent at current spending", ceiling, "EUR/month", "housing today plus monthly surplus, floored at zero", { source: "calculation" }),
  ];
  const steps = [
    { label: "Housing today", amount: housing, basis: "12-month average housing payments" },
    { label: "Monthly surplus at current spending", amount: gap, basis: "same spending and saving as in the synthetic bank data" },
    { label: "Break-even monthly rent", amount: ceiling, basis: "housing today + monthly surplus; leaves no extra room" },
  ];
  const directAnswer = `At your current spending, about €${ceiling.toFixed(2)} a month is the break-even rent. Your housing averages €${housing.toFixed(2)} and an average month ${gap < 0 ? `runs €${Math.abs(gap).toFixed(2)} short` : `leaves €${gap.toFixed(2)} over`}. Choose a lower rent to leave room for a buffer, deposit and moving costs. What monthly rent limit would you like to use for your search? That chosen limit is separate from what your finances support.`;
  return outcome({ content: JSON.stringify({ housingTodayEur: housing, monthlySurplusEur: gap, breakEvenRentEur: ceiling, dataAsOf: o.dataTimestamp, tellTheCustomer: "Explain this is the break-even ceiling using her current financial data, not a comfortable recommendation. A lower rent leaves room for a buffer, deposit, moving costs and other changes. Ask what rent limit she chooses for the search; do not treat the calculated ceiling as her chosen limit. If she later chooses a higher search limit, keep it and explain the financial trade-off instead of replacing it." }), directAnswer, summary: `Break-even rent €${ceiling}/month at current spending; the search limit is the customer's choice`, facts, stages: [{ kind: "calculation", title: "Rent affordability from your data", summary: "Break-even ceiling, before extra moving costs or a new buffer", source: "calculation", facts, data: { kind: "calculation", steps, resultLabel: "Break-even rent", resultValue: ceiling, unit: "EUR/month", assumptions: ["Synthetic profile; twelve-month averages, not a forecast.", "The same other spending and saving continue.", "A search limit is a customer choice, separate from affordability."] } }] });
}

export function getWatchFindings(ctx: ToolContext, housingOnly = false): ToolOutcome {
  const watches = listWatches(ctx.customerId).filter(watch => !housingOnly || (watch.priceUnit === "EUR/month" && !watch.topic));
  const ids = new Set(watches.map(watch => watch.id));
  const notes = listNotifications(ctx.customerId).filter(note => ids.has(note.watchId)).slice(0, 5);
  const citations = notes.map(note => ({ title: `${note.simulated ? "Simulated monitoring update · Source reference" : "Listing"}: ${note.listing.title}`, url: note.listing.url, retrievedAt: note.detectedAt, cacheAgeMs: null }));
  const latest = notes[0];
  const listing = latest?.listing;
  const details = listing ? [listing.rooms === null ? "rooms not stated" : `${listing.rooms} rooms`, listing.areaM2 === null ? "size not stated" : `${listing.areaM2} m²`].join(", ") : "";
  const directAnswer = latest && listing ? `${latest.simulated ? "Simulated monitoring update" : "Yes"}: ${listing.title}, €${listing.priceEur} ${housingOnly || watches.find(watch => watch.id === latest.watchId)?.priceUnit === "EUR/month" ? "a month" : ""}, ${details}. ${latest.simulated ? "Source reference" : "Source"}: ${new URL(listing.url).hostname.replace(/^www\./, "")}. ${latest.simulated ? "This finding and price are simulated for the demo; the source page is not a live offer at this price." : "Check the listing's own page for availability and terms."}`
    : watches.length ? `No new findings are saved for your ${housingOnly ? "flat " : ""}watch in this session yet.${watches[0].lastCheckedAt ? ` It was last checked at ${watches[0].lastCheckedAt}.` : " It has not been checked again since approval."}`
      : `There is no saved ${housingOnly ? "housing " : ""}project for this profile in this session. Approve a project first to save its findings here.`;
  return outcome({ content: JSON.stringify({ projects: watches.map(watch => ({ id: watch.id, city: watch.city, minRooms: watch.minRooms, maxRentEur: watch.budgetEur, status: watch.status, lastCheckedAt: watch.lastCheckedAt })), findings: notes.map(note => ({ projectId: note.watchId, title: note.listing.title, rentEur: note.listing.priceEur, rooms: note.listing.rooms, areaM2: note.listing.areaM2, source: note.listing.url, simulated: note.simulated, summary: note.summary })) }), directAnswer, summary: `${notes.length} saved findings in ${watches.length} projects in this session`, citations, facts: notes.flatMap(note => note.facts) });
}
