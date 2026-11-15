"use client";
// Today's fixed header: the greeting and the settings button (and, once, the notice that the app fell back to
// the demo data). No streak or berries: the data date sits with the money overview below.
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { TransientNotice } from "@/web/shared/Notice";
import { SisuIconButton } from "@/web/shared/SisuStyle";
import { FitText } from "./FitText";
import "./today.css";

export function TodayHeader() {
  const model = useAppModel();
  const name = useAppSelector((s) => s.customer?.displayName ?? "");
  const customerId = useAppSelector((s) => s.customer?.customerId ?? "");
  const hasOverview = useAppSelector((s) => s.overview !== null);
  const fellBack = useAppSelector((s) => s.backendAnswered === false && !s.sampleOnly);

  return (
    <header className="sisu-today-header">
      <div className="sisu-today-header-row">
        <FitText as="h1" className="sisu-today-greeting" text={TodayPresenter.greeting(name)} />
        <SisuIconButton icon="settings" style="tinted" label="Settings" action={() => model.setTodaySheet("settings")} />
      </div>
      {/* Said once, at the moment the app fell back from the live backend to the demo data. */}
      {hasOverview && fellBack ? (
        <TransientNotice id={`overview-fallback-${customerId}`}
          text="Sisu's server did not answer, so you see the demo data." />
      ) : null}
    </header>
  );
}
