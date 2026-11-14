"use client";
// Settings > Data and sources: where the figures come from, whether the backend answered and when, the data
// date, and that the profiles are fictional. The one place the screens' source and freshness are spelled out
// (the demo itself is disclosed once, at profile selection). Port of DataSourcesCard in Sheets.swift.
import { useAppSelector, useCoach, useCoachSession, useCoachSessionState, useCoachStore } from "@/web/app/AppProvider";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { useDataFreshness } from "@/web/shared/DataFreshness";
import { SisuCard } from "@/web/shared/SisuStyle";
import { backendAddress, formatDateTime, formatTime, joinNames } from "./settingsText";
import "./sheets.css";

export function DataSourcesCard() {
  const customers = useAppSelector((s) => s.customers);
  const isLive = useAppSelector((s) => s.isLive);
  const sampleOnly = useAppSelector((s) => s.sampleOnly);
  const baseURLString = useAppSelector((s) => s.baseURLString);
  const backendAnswered = useAppSelector((s) => s.backendAnswered);
  const overview = useAppSelector((s) => s.overview);
  const fetchedAt = useDataFreshness();
  const store = useCoachStore();
  useCoach();
  const session = useCoachSession();
  useCoachSessionState(session);
  const fallenBackAt = store.fallenBackAt;
  const address = backendAddress(baseURLString);

  const names = joinNames(customers.map((customer) => customer.displayName));
  const who = names === "" ? "The demo profiles" : `The demo profiles (${names})`;
  const profiles = `${who} are fictional people built on synthetic S-Pankki data. No real customer's data is shown.`;

  const source = isLive
    ? `Live from the Sisu backend at ${address}.`
    : sampleOnly
      ? "The demo data bundled with the app. Sisu is not asking a server."
      : `The demo data bundled with the app, because the backend at ${address} did not answer.`;

  const backend = backendAnswered === true
    ? "Answered."
    : backendAnswered === false
      ? "Did not answer, so Sisu switched to the demo data."
      : "Not asked (demo data only).";

  const fetchedParts = [
    ...(fetchedAt ? [`Figures ${formatDateTime(fetchedAt)}.`] : []),
    ...(fallenBackAt ? [`Coach switched to recorded answers ${formatTime(fallenBackAt)}.`] : []),
  ];
  const fetched = fetchedParts.length ? fetchedParts.join(" ") : null;

  const coach = (() => {
    switch (session?.dataLabel) {
      case "live": return "Live answers from the Sisu server.";
      case "mock": return "Mock data: the server says its answers are examples.";
      case "sample": return "Sample data: answers recorded from the Sisu server.";
      default: return "Not started yet.";
    }
  })();

  const rows: [string, string][] = [
    ["Figures", source],
    ["Backend", backend],
    ...(fetched ? [["Last fetched", fetched] as [string, string]] : []),
    ...(overview ? [["Data date", TodayPresenter.dataDate(overview)] as [string, string]] : []),
    ["Coach answers", coach],
    ["Profiles", profiles],
  ];

  return (
    <SisuCard>
      <h3 className="sisu-sheet-h3">Data and sources</h3>
      {rows.map(([title, text], index) => (
        <div key={title} className="sisu-sources-item">
          {index > 0 ? <hr className="sisu-sheet-divider" /> : null}
          <div className="sisu-sources-row">
            <span className="sisu-sheet-label-muted">{title}</span>
            <span className="sisu-sheet-text">{text}</span>
          </div>
        </div>
      ))}
    </SisuCard>
  );
}
