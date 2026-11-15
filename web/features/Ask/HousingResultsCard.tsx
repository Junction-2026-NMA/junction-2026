"use client";
// v2 housing: the results of the intake card's search, short at first. The verdict, then the best match (only a
// listing that meets every requirement, checked) or, when there is none, the closest one labelled "Needs
// checking", then closed sections: more listings, why the others were excluded, the maths and the sources. With
// nothing that qualifies it says so and offers to adjust the search or keep monitoring (the Project card below).
import { useState } from "react";
import { type HousingIntake, type HousingSearchResult, HousingText } from "@/web/core/HousingModels";
import { SisuButton, SisuCard } from "@/web/shared/SisuStyle";
import { Disclosure } from "./Disclosure";
import { ExcludedList, ListingCard, MathsList, RequirementTable, ResearchSources } from "./HousingParts";
import { HousingIntakeCard } from "./HousingIntakeCard";
import "@/web/features/Projects/projects.css";
import "./housing.css";

export function HousingResultsCard({ result, intake }: { result: HousingSearchResult; intake: HousingIntake | null }) {
  const [adjusting, setAdjusting] = useState(false);
  const shown = result.best ?? result.closest;
  const others = [...result.fitting, ...result.needsChecking].filter((one) => one.key !== shown?.key);
  const goal = typeof result.criteria.requirements.savingsGoalEurPerMonth === "number" ? result.criteria.requirements.savingsGoalEurPerMonth : null;
  const nothing = result.best === null;
  const keepMonitoring = () => document.querySelector<HTMLElement>("[data-testid='watch.card']")?.scrollIntoView({ behavior: "smooth", block: "center" });
  const retrieved = result.research.read[0];

  return (
    <>
      <SisuCard className="sisu-project-enter" testId="housing.results">
        <div className="sisu-housing-card">
          <p className="sisu-housing-verdict" data-testid="housing.verdict">{result.verdict}</p>
          {result.research.mock ? <p className="sisu-project-muted">Example listings: no live search was made on this server.</p> : null}
          {shown ? <ListingCard one={shown} heading={result.best ? "Best match" : "Closest match: needs checking"} savingsGoal={goal} /> : null}
          {nothing ? (
            <p className="sisu-project-body">
              {result.closest
                ? "It can't be the best match until the unknowns are checked. You can adjust the search, or let Sisu keep monitoring for a home that meets everything."
                : `Nothing read today meets your requirements${result.excluded.length ? ", and why each one was left out is below" : ""}. You can adjust the search, or let Sisu keep monitoring the pages.`}
            </p>
          ) : null}
          {others.length ? (
            <Disclosure label={`${others.length} more listing${others.length === 1 ? "" : "s"}`} testId="housing.more">
              {others.map((one) => <ListingCard key={one.key} one={one} heading={one.verdict === "fits" ? "Meets every requirement" : "Needs checking"} savingsGoal={goal} />)}
            </Disclosure>
          ) : null}
          <Disclosure label="Why others were excluded" count={result.excluded.length} testId="housing.excluded">
            <ExcludedList excluded={result.excluded} />
          </Disclosure>
          <Disclosure label="Show the maths" testId="housing.maths">
            <MathsList steps={[...result.budget.steps, ...result.maths]} assumptions={result.assumptions} reasoning={result.budget.reasoning} />
            <p className="sisu-project-subhead">Each listing against each requirement</p>
            <RequirementTable evaluation={result} />
          </Disclosure>
          <Disclosure label="Sources" count={result.research.sources.length} testId="housing.sources">
            <ResearchSources research={result.research} />
          </Disclosure>
          {retrieved ? <p className="sisu-project-muted">{`Listings ${HousingText.retrieved(retrieved.retrievedAt, retrieved.cached).toLowerCase()}. Check each listing's own page before you contact anyone.`}</p> : null}
          {nothing ? (
            <div className="sisu-project-actions">
              {intake ? <button type="button" className="sisu-project-small" onClick={() => setAdjusting((was) => !was)} data-testid="housing.adjust">Adjust the search</button> : null}
              {result.action ? <button type="button" className="sisu-project-small" data-kind="primary" onClick={keepMonitoring}>Keep monitoring</button> : null}
            </div>
          ) : intake ? (
            <SisuButton label={adjusting ? "Close" : "Adjust the search"} style="secondary" action={() => setAdjusting((was) => !was)} />
          ) : null}
          {result.actionProblem ? <p className="sisu-project-muted">{result.actionProblem}</p> : null}
        </div>
      </SisuCard>
      {adjusting && intake ? <HousingIntakeCard intake={intake} previous={result.criteria} onDone={() => setAdjusting(false)} /> : null}
    </>
  );
}
