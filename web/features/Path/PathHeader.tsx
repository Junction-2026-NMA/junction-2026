"use client";
// The path's fixed header: "Your path", the streak and berries pills, and once the lessons are in, the line
// under the title and the progress bar. PathHeader in ios/Sisu/Features/Path/PathScreen.swift.
import { DailyProgress } from "@/web/core/AppLogic/DailyProgress";
import { LessonPathPresenter } from "@/web/core/AppLogic/LessonPath";
import { RiveBindings } from "@/web/core/RiveContract";
import { useAppSelector } from "@/web/app/AppProvider";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { Hug, RiveHug, riveAccessible } from "@/web/shared/SisuStyle";
import type { PathSnapshot } from "./PathModel";

export function PathHeader({ path }: { path: PathSnapshot }) {
  const daily = useAppSelector((s) => s.progress);
  const streak = DailyProgress.streakText(daily);
  // The same tight pills as Today's header: each hugs its text, side by side.
  const berries = LessonPathPresenter.berriesText(daily, path.progress);
  const loaded = path.state.kind === "loaded";
  const text = LessonPathPresenter.progressText(path.cards, path.progress);

  return (
    <div className="sisu-path-header">
      <div className="sisu-path-header-row">
        <h1 className="sisu-path-title">Your path</h1>
        <div className="sisu-path-pills">
          <Hug width={RiveHug.statPill(streak)}>
            <RiveComponent component="StatPill" values={RiveValues.statPill("streak", streak)}
              {...riveAccessible("Streak", { value: `${streak} days` })} />
          </Hug>
          <Hug width={RiveHug.statPill(berries, "berries")}>
            <RiveComponent component="StatPill" values={RiveValues.statPill("berries", berries)}
              {...riveAccessible("Berries", { value: berries })} />
          </Hug>
        </div>
      </div>
      {loaded ? (
        <>
          {/* Where the lessons come from is in Settings > Data and sources; no badge here. */}
          <p className="sisu-path-subtitle">{LessonPathPresenter.subtitle(path.cards, path.progress)}</p>
          <div className="sisu-path-progress">
            <RiveComponent component="ProgressBar"
              values={RiveBindings.progressBar(LessonPathPresenter.fraction(path.cards, path.progress))}
              {...riveAccessible("Lessons", { value: text })} />
            <span className="sisu-path-progress-text" aria-hidden="true">{text}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
