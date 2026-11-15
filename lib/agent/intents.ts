// Clear requests choose their first tool in code. The model still explains its real result;
// a previous turn's action must not turn a housing search or lesson into a transfer.
import type { ChatTurn } from "@/lib/types";
import type { ToolCall } from "./model";

const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({ id: `intent_${crypto.randomUUID()}`, type: "function", function: { name, arguments: JSON.stringify(args) } });

export function firstToolFor(text: string, history: ChatTurn[] = []): ToolCall | null {
  if (/\b(watch|project)\b/i.test(text) && /\b(found|find anything|find something|findings|any (news|updates|matches)|status)\b/i.test(text)) return call("get_watch_findings", { housingOnly: /\b(flat|apartment|home|housing)\b/i.test(text) });
  if (/\brent\b/i.test(text) && /\b(how much|what)\b.*\b(afford|budget)\b/i.test(text)) return call("get_rent_budget");
  if (/\b(buffer|emergency fund)\b/i.test(text) && /\b(teach|explain|how (big|much)|should)\b/i.test(text)) return call("explain_concept", { concept: "buffer-first" });
  if (/\b(fixed|spot)\b/i.test(text) && /\b(electricity|price|contract)\b/i.test(text)
    && (/\bfixed\b/i.test(text) && /\bspot\b/i.test(text) && /\b(pick|choose|should|versus|or)\b/i.test(text) || /\b(explain|teach)\b/i.test(text))) return call("explain_concept", { concept: "fixed-vs-spot" });
  if (/\b(landlord|rent increase|raise my rent)\b/i.test(text) && /\b(allowed|legal|right|can|raise|increase)\b/i.test(text)) return call("web_search", { query: "site:kkv.fi Finland rental apartment rent increase tenancy agreement notice conditions" });

  const housing = /\b(flat|apartment|home)\b/i.test(text) && /\b(find|search|look|watch)\b/i.test(text);
  const limit = text.match(/\b(?:under|below|up to|at most|maximum|max)\s*€?\s*(\d+(?:[.,]\d+)?)/i);
  if (housing && limit) {
    const room = text.match(/\b(one|two|three|four|five|six|[1-6])[-\s]+rooms?\b/i);
    const counts: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const city = text.match(/\bin\s+(Helsinki|Espoo|Vantaa|Tampere|Turku|Oulu)\b/i)?.[1];
    return call("search_flats", { budgetEur: Number(limit[1].replace(",", ".")), ...(city ? { city } : {}), ...(room ? { minRooms: counts[room[1].toLowerCase()] ?? Number(room[1]) } : {}), ...(/\b(keep|continue|watch|monitor)\b/i.test(text) ? { watch: true } : {}) });
  }
  const electricity = /\belectricity\b/i.test(text) && /\b(cheaper|deal|offer|switch|compare)\b/i.test(text);
  const tariffFollowUp = /\b(kwh|cents?|monthly fee)\b/i.test(text) && history.slice(-4).some(turn => /\belectricity\b/i.test(turn.content));
  if (electricity || tariffFollowUp) {
    // Preserve explicitly requested contract constraints when skipping the model's tool choice.
    const terms = [...history.filter(turn => turn.role === "user").map(turn => turn.content), text].join(" ");
    const months = terms.match(/\b(\d+)\s*months?\s*(?:or less|or fewer|maximum|at most)/i)
      ?? terms.match(/\b(?:at most|up to|max(?:imum)?)\s*(\d+)\s*months?/i);
    const fixed = /\b(?:want|prefer|only|choose|find)\b[^.?!]*\bfixed\b/i.test(terms);
    const spot = /\b(?:want|prefer|only|choose|find)\b[^.?!]*\bspot\b/i.test(terms);
    return call("search_offers", { billType: "electricity", ...(months ? { maxContractMonths: Number(months[1]) } : {}), ...(fixed !== spot ? { contractType: fixed ? "fixed" : "spot" } : {}), ...(/\b(?:green|renewable) (?:energy|electricity|only)\b/i.test(terms) ? { greenOnly: true } : {}), ...(/\bno (?:setup|opening) fee\b/i.test(terms) ? { noSetupFee: true } : {}) });
  }
  return null;
}
