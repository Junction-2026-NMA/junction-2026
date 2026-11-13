"use client";

import type { EvidenceFilter, Overview } from "@/lib/types";
import { Card, Eyebrow, EvidenceButton } from "./ui";

type Props = { overview: Overview; onEvidence: (title: string, filter: EvidenceFilter) => void };

export function InsightsCard({ overview, onEvidence }: Props) {
  if (!overview.insights.length) return null;
  return (
    <Card>
      <Eyebrow>Sisu noticed</Eyebrow>
      <ul className="mt-2 divide-y divide-line">
        {overview.insights.map((insight) => (
          <li key={insight.id} className="py-4 first:pt-2 last:pb-0">
            <p className="text-lg font-semibold leading-snug">{insight.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{insight.body}</p>
            <EvidenceButton onClick={() => onEvidence(insight.title, insight.evidence)}>See the transactions</EvidenceButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}
