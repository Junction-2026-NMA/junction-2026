"use client";
// Today's fixed header: the greeting, the streak and berries pills, the settings button, then the data date
// (and, once, the notice that the app fell back to the demo data). Port of TodayHeader in TodayScreen.swift.
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { TodayPresenter } from "@/web/core/AppLogic/AppPresenters";
import { DailyProgress } from "@/web/core/AppLogic/DailyProgress";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { TransientNotice } from "@/web/shared/Notice";
import { RiveValues } from "@/web/shared/RiveValues";
import { Hug, RiveHug, SisuIconButton, riveAccessible } from "@/web/shared/SisuStyle";
import { FitText } from "./FitText";
import "./today.css";

export function TodayHeader() {
  const model = useAppModel();
  const name = useAppSelector((s) => s.customer?.displayName ?? "");
  const customerId = useAppSelector((s) => s.customer?.customerId ?? "");
  const streakText = useAppSelector((s) => DailyProgress.streakText(s.progress));
  const berriesText = useAppSelector((s) => s.berriesText);
  const overview = useAppSelector((s) => s.overview);
  const fellBack = useAppSelector((s) => s.backendAnswered === false && !s.sampleOnly);

  return (
    <header className="sisu-today-header">
      <div className="sisu-today-header-row">
        <FitText as="h1" className="sisu-today-greeting" text={TodayPresenter.greeting(name)} />
        <div className="sisu-today-pills">
          <Hug width={RiveHug.statPill(streakText)}>
            <RiveComponent component="StatPill" values={RiveValues.statPill("streak", streakText)}
              {...riveAccessible("Streak", { value: `${streakText} days` })} testId="today.streak" />
          </Hug>
          <Hug width={RiveHug.statPill(berriesText, "berries")}>
            <RiveComponent component="StatPill" values={RiveValues.statPill("berries", berriesText)}
              {...riveAccessible("Berries", { value: berriesText })} testId="today.berries" />
          </Hug>
        </div>
        <SisuIconButton icon="settings" style="tinted" label="Settings" action={() => model.setTodaySheet("settings")} />
      </div>
      {overview ? (
        <>
          <p className="sisu-today-caption">{TodayPresenter.dataDate(overview)}</p>
          {/* Said once, at the moment the app fell back from the live backend to the demo data. */}
          {fellBack ? (
            <TransientNotice id={`overview-fallback-${customerId}`}
              text="Sisu's server did not answer, so you see the demo data." />
          ) : null}
        </>
      ) : null}
    </header>
  );
}
