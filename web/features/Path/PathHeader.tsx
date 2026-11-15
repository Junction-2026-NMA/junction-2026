"use client";
// The path's fixed header: "Your path" with the settings button, and once the lessons are in, the line under the
// title and the progress ("3 of 7 lessons"). No points, berries or streaks.
import { LessonPathPresenter } from "@/web/core/AppLogic/LessonPath";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { SisuIconButton, riveAccessible } from "@/web/shared/SisuStyle";
import type { PathSnapshot } from "./PathModel";

export function PathHeader({ path, openSettings }: { path: PathSnapshot; openSettings: () => void }) {
  const loaded = path.state.kind === "loaded";
  const text = LessonPathPresenter.progressText(path.cards, path.progress);

  return (
    <div className="sisu-path-header">
      <div className="sisu-path-header-row">
        <h1 className="sisu-path-title">Your path</h1>
        <SisuIconButton icon="settings" style="tinted" label="Settings" action={openSettings} />
      </div>
      {loaded ? (
        <>
          <p className="sisu-path-subtitle">{LessonPathPresenter.subtitle(path.cards, path.progress)}</p>
          <div className="sisu-path-progress">
            <span className="sisu-path-progress-text" data-testid="path.progress">{text}</span>
            <RiveComponent component="ProgressBar"
              values={RiveBindings.progressBar(LessonPathPresenter.fraction(path.cards, path.progress))}
              {...riveAccessible("Lessons", { value: text })} />
          </div>
        </>
      ) : null}
    </div>
  );
}
