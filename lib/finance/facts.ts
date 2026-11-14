import type { EvidenceFilter, Fact, FactUnit, SourceKind } from "@/lib/types";
import { round2 } from "./math";

// Builds one receipt. Every number a tool hands to the model should also be handed over as one of these.
export function fact(id: string, label: string, value: number, unit: FactUnit, basis: string, options: { source?: SourceKind; evidence?: EvidenceFilter; url?: string } = {}): Fact {
  return { id, label, value: round2(value), unit, source: options.source ?? "bank-data", basis, ...(options.evidence ? { evidence: options.evidence } : {}), ...(options.url ? { url: options.url } : {}) };
}
