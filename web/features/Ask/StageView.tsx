"use client";
// One stage card of an answer, by kind: evidence (with its transactions), research pages, the offer table read
// from them, the working, the futures, memory, and the quiz / action stages. Port of StageView in AskCards.swift.
import { useAppModel } from "@/web/app/AppProvider";
import { CoachProviderName } from "@/web/core/AppLogic/CoachAppLogic";
import type { AgentAction, Stage } from "@/web/core/CoachModels";
import { CoachText, FuturesPresenter, OfferPresenter, StagePresenter, type StageCard } from "@/web/core/CoachPresentation";
import type { CoachMessage } from "@/web/core/CoachSession";
import { jsonEqual } from "@/web/core/Presentation";
import { SisuButton, SisuCard } from "@/web/shared/SisuStyle";
import { ActionCard } from "./ActionCard";
import { Assumptions, Divider, Footnote, LinesView, MemoryLine, Note, SourceLink, StageHeader } from "./CardParts";
import { ImpactChart } from "./ImpactChart";
import { OfferTable, ResearchFooter } from "./Offers";
import { QuizCard } from "./QuizCard";

const language = "en";

export function StageView({ stage, message, actions }: { stage: Stage; message: CoachMessage; actions: readonly AgentAction[] }) {
  const data = stage.data;
  if (data.kind === "teaching") return <QuizCard card={data.card} />;
  if (data.kind === "action") {
    const newest = actions.find((one) => one.id === data.action.id);
    return <ActionCard action={newest ?? data.action} />;
  }
  const card = StagePresenter.card(stage, language);
  return (
    <SisuCard>
      <StageHeader eyebrow={eyebrow(stage)} card={card} showSummary={stage.kind !== "memory"} />
      <StageContent stage={stage} message={message} card={card} />
      {card.isMock ? (
        // Part of the card's source line, not a badge: the server itself says these are example pages.
        <Footnote text={CoachText.mockDataTag(language)} ariaLabel="Mock data. These pages are example data." />
      ) : null}
    </SisuCard>
  );
}

function eyebrow(stage: Stage): string {
  const data = stage.data;
  switch (data.kind) {
    case "lead": return CoachText.sourceLabel(stage.source, language);
    case "evidence": return "From your transactions";
    case "research": return "Searched with " + CoachProviderName.display(data.searchedWith ?? "exa");
    case "extraction": return "Read with " + CoachProviderName.display(data.extractedWith ?? "context.dev");
    case "calculation": return "The working";
    case "impact": return "Your futures";
    case "memory": return "Memory";
    default: return CoachText.sourceLabel(stage.source, language);
  }
}

function StageContent({ stage, message, card }: { stage: Stage; message: CoachMessage; card: StageCard }) {
  const model = useAppModel();
  const data = stage.data;
  switch (data.kind) {
    case "evidence": {
      const [first, ...rest] = card.lines;
      return (
        <>
          {first ? (
            <div className="sisu-ask-baseline">
              <span className="sisu-ask-h2">{first.value ?? ""}</span>
              <span className="sisu-ask-body sisu-ask-muted">{first.label}</span>
            </div>
          ) : null}
          <LinesView lines={rest} />
          <SisuButton label="Show transactions" style="secondary" action={() => model.showEvidence(stage.title, data.filter)} />
        </>
      );
    }
    case "research":
      return (
        <>
          <div className="sisu-ask-sources">
            {data.pages.map((page) => <SourceLink key={page.url} title={page.title} url={page.url} />)}
          </div>
          {card.footnote ? <Footnote text={card.footnote} /> : null}
        </>
      );
    case "extraction":
      return (
        <>
          <OfferTable rows={data.offers.map((offer) => OfferPresenter.row(offer, jsonEqual(message.research?.best ?? null, offer), language))} />
          <Footnote text={`Pages read: ${data.pagesRead} of ${data.pagesTotal}`} />
          {data.problems.length > 0 ? (
            <Note text="Some pages could not be read, so a few offers may be missing." lines={data.problems} />
          ) : null}
          {message.research ? <ResearchFooter research={message.research} /> : null}
        </>
      );
    case "calculation":
      return (
        <>
          <LinesView lines={card.lines} />
          <Divider />
          <div className="sisu-ask-result">
            <span className="sisu-ask-h3">{data.resultLabel}</span>
            <span className="sisu-ask-h3 sisu-ask-result-value">{CoachText.value(data.resultValue, data.unit, language)}</span>
          </div>
          <Assumptions items={data.assumptions} />
        </>
      );
    case "impact":
      return (
        <>
          <ImpactChart series={FuturesPresenter.series(data.impact, language)} />
          <p className="sisu-ask-body">{data.impact.summary}</p>
        </>
      );
    case "memory":
      return <MemoryLine text={card.summary === "" ? data.item.value : card.summary} />;
    default:
      return <LinesView lines={card.lines} />;
  }
}
