"use client";
// "What Sisu noticed": one pressable card per insight, each opening the transactions behind it.
// Port of InsightsSection in TodaySections.swift.
import { useAppModel } from "@/web/app/AppProvider";
import type { Overview } from "@/web/core/Models";
import { SectionTitle, SisuPressableCard } from "@/web/shared/SisuStyle";
import { Chevron } from "./Glyphs";
import "./today.css";

export function InsightsSection({ overview }: { overview: Overview }) {
  const model = useAppModel();
  if (overview.insights.length === 0) return null;
  return (
    <section className="sisu-today-section">
      <SectionTitle title="What Sisu noticed" />
      {overview.insights.map((insight) => (
        <SisuPressableCard key={insight.id} onPress={() => model.showEvidence(insight.title, insight.evidence)}>
          <span className="sisu-today-insight">
            <span className="sisu-today-insight-text">
              <span className="sisu-today-h3">{insight.title}</span>
              <span className="sisu-today-body-muted">{insight.body}</span>
            </span>
            <span className="sisu-today-chevron-green sisu-today-insight-chevron"><Chevron size={14} /></span>
          </span>
        </SisuPressableCard>
      ))}
    </section>
  );
}
