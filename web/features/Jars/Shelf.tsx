"use client";
// The shelf: the buffer jar, the "Freed by switches" jar and the berries. Port of Shelf and JarTile in
// ios/Sisu/Features/Jars/JarsScreen.swift.
import { useLayoutEffect, useRef, useState } from "react";
import type { Overview } from "@/web/core/Models";
import type { RiveValueMap } from "@/web/core/RiveContract";
import { JarsPresenter, NumberText } from "@/web/core/AppLogic/AppPresenters";
import { useAppSelector } from "@/web/app/AppProvider";
import { RiveComponent } from "@/web/rive/RiveComponent";
import { RiveValues } from "@/web/shared/RiveValues";
import { riveAccessible, sisuCardSurface, SisuCard } from "@/web/shared/SisuStyle";

export function Shelf({ overview }: { overview: Overview }) {
  const approvedMonthlySaving = useAppSelector((s) => s.approvedMonthlySaving);
  const billMonthly = useAppSelector((s) => s.flaggedBill?.monthlyAvg ?? 0);
  const berries = useAppSelector((s) => s.berries);
  const berriesText = useAppSelector((s) => s.berriesText);
  const berryDrops = useAppSelector((s) => s.berryDrops);

  const bufferFill = JarsPresenter.bufferFill(overview.runwayMonths);
  const freedFill = JarsPresenter.freedFill(approvedMonthlySaving, billMonthly);

  return (
    <div className="sisu-jars-shelf">
      <div className="sisu-jars-tiles">
        <JarTile
          title="Buffer"
          figure={JarsPresenter.bufferFigure(overview.runwayMonths)}
          detail={JarsPresenter.bufferDetail}
          values={RiveValues.jar(bufferFill, "Buffer")}
          accessibility={`Buffer jar, ${NumberText.percent(bufferFill)} full`}
        />
        <JarTile
          title="Switches"
          figure={JarsPresenter.freedFigure(approvedMonthlySaving)}
          detail={JarsPresenter.freedDetail(approvedMonthlySaving)}
          values={RiveValues.jar(freedFill, "Switches")}
          triggers={[`celebrate#${approvedMonthlySaving}`]}
          accessibility={`Freed by switches jar, ${NumberText.percent(freedFill)} full`}
        />
      </div>
      <SisuCard>
        <div className="sisu-jars-berries">
          <RiveComponent
            component="Berries"
            values={RiveValues.berries(berries)}
            triggers={[`drop#${berryDrops}`]}
            style={{ width: 128, height: 80, flex: "none" }}
            {...riveAccessible("Berries", { value: berriesText })}
          />
          <div className="sisu-jars-berries-text">
            <p className="sisu-jars-berries-caption">{JarsPresenter.berriesCaption(berries)}</p>
            <p className="sisu-jars-detail">Earned by showing up, never taken away.</p>
          </div>
        </div>
      </SisuCard>
    </div>
  );
}

const NO_TRIGGERS: readonly string[] = [];

/** One jar on a card, its figure and the line under it; read as one element ("Buffer: 1.1 months of …"). */
function JarTile({ title, figure, detail, values, triggers = NO_TRIGGERS, accessibility }: {
  title: string;
  figure: string;
  detail: string;
  values: RiveValueMap;
  /** Fires `celebrate` whenever the stamp changes (for the switches jar: when the approved saving changes). */
  triggers?: readonly string[];
  accessibility: string;
}) {
  const surface = sisuCardSurface();
  return (
    // role="text" is WebKit's way to read a group as one element (accessibilityElement(children: .combine)).
    <div className={`sisu-jars-tile ${surface.className}`} style={surface.style} role="text"
      aria-label={`${title}: ${figure} ${detail}`}>
      <div className="sisu-jars-tile-jar" aria-hidden="true">
        <RiveComponent component="Jar" values={values} triggers={triggers}
          style={{ width: "auto", height: "100%", maxWidth: "100%" }} {...riveAccessible(accessibility)} />
      </div>
      <FitLine text={figure} />
      <p className="sisu-jars-detail" aria-hidden="true">{detail}</p>
    </div>
  );
}

/** One line of H2 that shrinks to 80% before it truncates (lineLimit(1) + minimumScaleFactor(0.8)). */
function FitLine({ text }: { text: string }) {
  const line = useRef<HTMLParagraphElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = line.current;
    if (!outer || !inner.current) return;
    const fit = () => {
      const element = inner.current;
      if (!element) return;
      const current = parseFloat(element.style.fontSize) || 1;
      const natural = element.offsetWidth / current;
      const available = outer.clientWidth;
      const next = natural > available && natural > 0 ? Math.max(available / natural, 0.8) : 1;
      setScale((previous) => (Math.abs(previous - next) < 0.005 ? previous : next));
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [text]);

  return (
    <p ref={line} className="sisu-jars-figure" aria-hidden="true">
      <span ref={inner} style={{ fontSize: `${scale}em` }}>{text}</span>
    </p>
  );
}
