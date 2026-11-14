"use client";
// Jars: a shelf with the buffer jar, the "Freed by switches" jar and the berries, then the futures simulator:
// one predict-before-reveal question that must be answered before the three futures are shown.
// Port of ios/Sisu/Features/Jars/JarsScreen.swift.
// - `?scroll=question|futures` scrolls that section to the top 1.2 s after the screen appears (ScrollViewReader).
// - Until the overview has loaded the screen shows the loading state, like Today's LoadingState.
import { useEffect, useRef } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { Screen, ScreenStack } from "@/web/shared/Screen";
import { FuturesSection } from "./FuturesSection";
import { Shelf } from "./Shelf";
import "./jars.css";

export default function JarsScreen() {
  const model = useAppModel();
  const overview = useAppSelector((s) => s.overview);
  const scroller = useRef<HTMLDivElement>(null);
  const hasOverview = overview !== null;

  useEffect(() => {
    const target = model.launch.scroll;
    if (!hasOverview || !target) return;
    const timer = setTimeout(() => scrollToTop(scroller.current, target), 1200);
    return () => clearTimeout(timer);
  }, [model, hasOverview]);

  return (
    <Screen header={<JarsHeader />} scrollRef={scroller} testId="screen.jars">
      {overview ? (
        <ScreenStack className="sisu-jars-stack">
          <Shelf overview={overview} />
          <FuturesSection />
        </ScreenStack>
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}

function JarsHeader() {
  return (
    <div className="sisu-jars-header">
      <h1 className="sisu-jars-title">Jars</h1>
    </div>
  );
}

/** Today's LoadingState: a spinner and "Reading your last 12 months", centred. */
function LoadingState() {
  return (
    <div className="sisu-jars-loading">
      <div className="sisu-jars-spinner" role="progressbar" aria-label="In progress" />
      <p className="sisu-jars-loading-text">Reading your last 12 months</p>
    </div>
  );
}

/** proxy.scrollTo(id, anchor: .top): puts the section's top at the top of the scroll view, without animation. */
function scrollToTop(container: HTMLDivElement | null, id: string) {
  if (!container) return;
  const target = Array.from(container.querySelectorAll<HTMLElement>("[data-scroll-id]"))
    .find((element) => element.dataset.scrollId === id);
  if (!target) return;
  const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  const top = Math.min(Math.max(offset, 0), Math.max(container.scrollHeight - container.clientHeight, 0));
  container.scrollTo({ top, behavior: "auto" });
}
