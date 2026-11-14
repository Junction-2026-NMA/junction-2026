"use client";
// "Today's small steps": the berries earned, today's progress bar and the three daily actions (Rive ActionRow).
// Port of DailyActionsCard in TodayScreen.swift.
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { JarsPresenter, NumberText } from "@/web/core/AppLogic/AppPresenters";
import { DailyAction } from "@/web/core/AppLogic/DailyProgress";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { SisuCard, riveAccessible } from "@/web/shared/SisuStyle";
import "./today.css";

export function DailyActionsCard({ showBill }: { showBill: () => void }) {
  const model = useAppModel();
  const berries = useAppSelector((s) => s.berries);
  const progress = useAppSelector((s) => s.todayProgress);
  const doneKey = useAppSelector((s) => s.doneToday.join(","));
  const done = doneKey === "" ? [] : doneKey.split(",");

  const run = (action: DailyAction) => {
    switch (action) {
      case "checkIn": return;
      case "confirmBill": showBill(); return;
      case "investigate": model.startInvestigation(); return;
    }
  };

  return (
    <SisuCard>
      <div className="sisu-today-steps-head">
        <h3 className="sisu-today-h3">Today&apos;s small steps</h3>
        <span className="sisu-today-label-green">{JarsPresenter.berriesCaption(berries)}</span>
      </div>
      <RiveComponent component="ProgressBar" values={RiveValues.progress(progress)}
        {...riveAccessible("Today's steps", { value: NumberText.percent(progress) })} />
      <div className="sisu-today-steps-rows">
        {DailyAction.allCases.map((action) => {
          const isDone = done.includes(action);
          const title = DailyAction.title(action);
          const reward = DailyAction.rewardText(action);
          return (
            <RiveComponent key={action} component="ActionRow" testId={`today.action.${action}`}
              values={RiveValues.actionRow(title, reward, isDone)}
              onTrigger={(trigger) => { if (trigger === "pressed") run(action); }}
              {...riveAccessible(title, { isButton: !isDone, value: isDone ? "Done" : `${reward} berries`, action: () => run(action) })} />
          );
        })}
      </div>
    </SisuCard>
  );
}
