"use client";
// Settings > Data and privacy, in plain sentences: the demo data, its date, where the figures come from right now
// (live, or saved examples, always said), and what leaves the bank-data boundary (the backend's own
// `dataBoundary` sentences from GET /api/health when it answers). `useBackendStatus` feeds "Demo controls".
import { useEffect, useState } from "react";
import { useAppSelector, useCoach, useCoachSession, useCoachSessionState, useCoachStore } from "@/web/app/AppProvider";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { CoachClient } from "@/web/core/CoachClient";
import { useDataFreshness } from "@/web/shared/DataFreshness";
import { formatTime, joinNames } from "./settingsText";
import "./sheets.css";

/** Said when the backend's own sentences cannot be read. Kept to what the code does (see CLAUDE.md). */
const boundaryFallback = [
  "Your transactions stay in Sisu’s own backend. The answer model gets computed totals and a few facts, never the raw rows or your customer number.",
  "Web searches for prices send only a bill type and a city, never your figures, name or ID.",
  "Voice: your recording is turned into text by ElevenLabs, and Sisu’s replies are turned into speech there.",
  "Actions such as a switch or a transfer are simulated, and each one needs your tap to approve.",
];

let boundaryCache: Promise<string[] | null> | null = null;

export function DataSourcesCard() {
  const customers = useAppSelector((s) => s.customers);
  const isLive = useAppSelector((s) => s.isLive);
  const sampleOnly = useAppSelector((s) => s.sampleOnly);
  const baseURL = useAppSelector((s) => s.baseURLString);
  const overview = useAppSelector((s) => s.overview);
  const fetchedAt = useDataFreshness();
  const [boundary, setBoundary] = useState<string[] | null>(null);

  useEffect(() => {
    if (!isLive) return;
    let live = true;
    boundaryCache ??= CoachClient.live(baseURL).health()
      .then((report) => (Array.isArray(report.dataBoundary) && report.dataBoundary.length ? report.dataBoundary.filter((s) => typeof s === "string") : null))
      .catch(() => null);
    void boundaryCache.then((value) => { if (live) setBoundary(value); });
    return () => { live = false; };
  }, [isLive, baseURL]);

  const names = joinNames(customers.map((customer) => customer.displayName));
  const figures = isLive
    ? `Live from Sisu’s server${fetchedAt ? `, updated ${formatTime(fetchedAt)}` : ""}.`
    : sampleOnly
      ? "Saved example data on this phone (a demo setting). Nothing is asked from the server."
      : "Saved example data on this phone, because Sisu’s server did not answer.";

  return (
    <div className="sisu-settings-privacy" data-testid="settings.privacy">
      <p className="sisu-sheet-text">
        This is a demo. {names ? `${names} are` : "The profiles are"} fictional people built on synthetic S-Pankki data. No real customer’s data is shown, and comparisons with other people come from the same synthetic data.
      </p>
      {overview ? <p className="sisu-sheet-text">{TodayPresenter.dataDate(overview)}.</p> : null}
      <p className="sisu-sheet-text">{figures}</p>
      <h4 className="sisu-settings-subheading">What leaves the bank data</h4>
      <ul className="sisu-settings-list">
        {(boundary ?? boundaryFallback).map((line) => <li key={line} className="sisu-sheet-text">{line}</li>)}
      </ul>
    </div>
  );
}

/** Plain status lines for "Demo controls": the server, the coach's answers, a switch to recorded answers. */
export function useBackendStatus(): [string, string][] {
  const backendAnswered = useAppSelector((s) => s.backendAnswered);
  const store = useCoachStore();
  useCoach();
  const session = useCoachSession();
  useCoachSessionState(session);
  const server = backendAnswered === true ? "answering" : backendAnswered === false ? "not answering, so the app uses saved example data" : "not asked (sample data only)";
  const answers = (() => {
    switch (session?.dataLabel) {
      case "live": return "live from the server";
      case "mock": return "examples from a test server (mock data)";
      case "sample": return "recorded examples (sample data)";
      default: return "not started yet";
    }
  })();
  const fell = store.fallenBackAt;
  return [
    ["Server", server],
    ["Coach answers", answers],
    ...(fell ? [["Switched to recorded answers", formatTime(fell)] as [string, string]] : []),
  ];
}
