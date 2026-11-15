/* eslint-disable @typescript-eslint/no-namespace -- namespaces mirror Swift's caseless enums (see web/README.md). */
// Previous conversations with Sisu, kept on this device per customer (the app's defaults, `Keys.conversations`):
// the chat history drawer on the Sisu tab lists them, and opening one puts its messages back into the session, so
// Sisu keeps the context of that conversation (CoachSession.restore rebuilds the model history from it).
//
// Pure functions over plain JSON. Reading is defensive: anything that is not a conversation is skipped, so an old or
// hand-edited store never breaks the app. Nothing here goes to the server.
import type { ChatTurn } from "./CoachModels";
import type { CoachMessage } from "./CoachSession";

/** One stored conversation. Dates are ISO strings. */
export interface SavedConversation {
  readonly id: string;
  /** The first question, shortened. */
  readonly title: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly messages: readonly CoachMessage[];
  /** The teaching questions answered in it (CoachStore.quizChoices), so a reopened quiz stays answered. */
  readonly quizChoices: Readonly<Record<string, number>>;
}

/** Every customer's conversations, newest first. */
export type ConversationArchive = Readonly<Record<string, readonly SavedConversation[]>>;

export namespace ConversationHistory {
  /** Conversations kept per customer. */
  export const limit = 10;
  /** The whole archive stays under this many characters of JSON (localStorage holds about 5 MB). */
  export const maxChars = 1_500_000;
  /** Turns of context rebuilt for the model (the server keeps 12 as well). */
  export const contextTurns = 12;
  const titleLength = 56;
  const investigateText = "Look into my finances and find the best thing I can do.";
  const unheard = new Set(["", "(nothing heard)", "(voice question)"]);
  /** The sentence of a reply stopped before any of it arrived (CoachErrors.stopped): its card offers Try again. */
  export const stoppedReply = "Stopped before Sisu answered.";

  /** The stored archive, every entry checked. */
  export function decodeArchive(json: unknown): ConversationArchive {
    if (!isRecord(json)) return {};
    const entries = Object.entries(json).map(([customerId, list]) => [customerId, decodeList(list)] as const);
    return Object.fromEntries(entries.filter(([, list]) => list.length > 0));
  }

  export function decodeList(json: unknown): SavedConversation[] {
    if (!Array.isArray(json)) return [];
    return json.flatMap((item) => {
      const entry = decode(item);
      return entry ? [entry] : [];
    });
  }

  function decode(json: unknown): SavedConversation | null {
    if (!isRecord(json) || typeof json.id !== "string" || json.id === "" || !Array.isArray(json.messages)) return null;
    const messages = json.messages.filter(isMessage) as CoachMessage[];
    if (messages.length === 0) return null;
    const startedAt = validDate(json.startedAt) ?? validDate(json.updatedAt) ?? new Date(0).toISOString();
    const quiz = isRecord(json.quizChoices) ? json.quizChoices : {};
    const quizChoices = Object.fromEntries(Object.entries(quiz).filter(([, v]) => Number.isInteger(v) && (v as number) >= 0)) as Record<string, number>;
    return {
      id: json.id,
      title: typeof json.title === "string" && json.title.trim() !== "" ? json.title : title(messages),
      startedAt,
      updatedAt: validDate(json.updatedAt) ?? startedAt,
      messages,
      quizChoices,
    };
  }

  /** The drawer's title: the first real question, shortened at a word. */
  export function title(messages: readonly CoachMessage[]): string {
    const first = messages.find((m) => m.role === "user" && !unheard.has(m.text.trim()));
    if (!first) return messages.some((m) => m.role === "user") ? "Voice conversation" : "New conversation";
    const text = first.text.trim() === investigateText ? "Look into my finances" : first.text.trim().replace(/\s+/g, " ");
    if (text.length <= titleLength) return text;
    const cut = text.slice(0, titleLength);
    const space = cut.lastIndexOf(" ");
    return `${(space > 24 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
  }

  /** The messages worth keeping: settled copies (nothing pending), without unheard voice questions left empty (nor
   *  their empty replies). A reply in which nothing arrived is never kept blank: it is saved as stopped. */
  export function storable(messages: readonly CoachMessage[]): CoachMessage[] {
    const unheardIds = new Set(messages.filter((m) => m.role === "user" && m.pending && m.text === "").map((m) => m.id));
    return messages.flatMap((m, index) => {
      if (unheardIds.has(m.id)) return [];
      const settled = m.pending ? { ...m, pending: false, runningTool: null } : m;
      if (m.role !== "assistant" || !isBlank(m)) return [settled];
      const question = index > 0 ? messages[index - 1] : null;
      return question && unheardIds.has(question.id) ? [] : [{ ...settled, error: stoppedReply }];
    });
  }

  /** A reply in which nothing has arrived: no words, error, filler, steps, cards or action. */
  export function isBlank(m: CoachMessage): boolean {
    return m.role === "assistant" && m.text === "" && m.error === null && m.filler === null && m.stages.length === 0
      && m.steps.length === 0 && m.visuals.length === 0 && m.tools.length === 0 && m.action === null && m.teaching === null;
  }

  /** The entry to save for the conversation on screen, or null when it has no answer yet. Keeps the quiz picks of
   *  its own teaching cards only. */
  export function entry(id: string, messages: readonly CoachMessage[], quizChoices: Readonly<Record<string, number>>,
    existing: SavedConversation | null, now: Date): SavedConversation | null {
    const keep = storable(messages);
    if (!keep.some((m) => m.role === "assistant")) return null;
    const cards = new Set(keep.flatMap((m) => [m.teaching?.id, ...m.stages.map((s) => (s.data.kind === "teaching" ? s.data.card.id : undefined))]));
    const picks = Object.fromEntries(Object.entries(quizChoices).filter(([card]) => cards.has(card)));
    const at = now.toISOString();
    return { id, title: title(keep), startedAt: existing?.startedAt ?? at, updatedAt: at, messages: keep, quizChoices: picks };
  }

  /** `list` with `entry` first (replacing the one with its id), at most `limit` long. */
  export function upsert(list: readonly SavedConversation[], entry: SavedConversation): SavedConversation[] {
    return [entry, ...list.filter((c) => c.id !== entry.id)].slice(0, limit);
  }

  export function remove(list: readonly SavedConversation[], id: string): SavedConversation[] {
    return list.filter((c) => c.id !== id);
  }

  /** The archive with `customerId`'s list replaced, trimmed (oldest conversations of the biggest list first) until
   *  it fits `maxChars`. The newest conversation of this customer is always kept. */
  export function store(archive: ConversationArchive, customerId: string, list: readonly SavedConversation[], max = maxChars): ConversationArchive {
    let next: Record<string, readonly SavedConversation[]> = { ...archive, [customerId]: list };
    if (list.length === 0) next = Object.fromEntries(Object.entries(next).filter(([id]) => id !== customerId));
    for (let guard = 0; guard < 200 && JSON.stringify(next).length > max; guard += 1) {
      const [biggest] = Object.entries(next).filter(([, l]) => l.length > 1).sort((a, b) => b[1].length - a[1].length);
      if (!biggest) break;
      next = { ...next, [biggest[0]]: biggest[1].slice(0, -1) };
    }
    return next;
  }

  /** The model history of a conversation: each answered question and its answer, the last `contextTurns`. */
  export function chatTurns(messages: readonly CoachMessage[]): ChatTurn[] {
    const turns: ChatTurn[] = [];
    messages.forEach((m, index) => {
      if (m.role !== "assistant" || m.error !== null || m.text.trim() === "") return;
      const question = index > 0 ? messages[index - 1] : null;
      if (!question || question.role !== "user" || unheard.has(question.text.trim())) return;
      turns.push({ role: "user", content: clip(question.text) }, { role: "assistant", content: clip(m.text) });
    });
    return turns.slice(-contextTurns);
  }

  /** "Today, 14:05", "Yesterday", "Mon", "12 Nov", "12 Nov 2025". */
  export function dateLabel(iso: string, now: Date, timeZone?: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    const days = Math.round((Date.parse(day(now)) - Date.parse(day(date))) / 86_400_000);
    if (days === 0) return `Today, ${new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date)}`;
    if (days === 1) return "Yesterday";
    if (days > 1 && days < 7) return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(date);
    const sameYear = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric" });
    const options: Intl.DateTimeFormatOptions = sameYear.format(date) === sameYear.format(now)
      ? { timeZone, day: "numeric", month: "short" }
      : { timeZone, day: "numeric", month: "short", year: "numeric" };
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }

  /** How many questions a conversation holds (the drawer's second line). */
  export function questionCount(conversation: SavedConversation): number {
    return conversation.messages.filter((m) => m.role === "user").length;
  }

  function clip(text: string): string { return text.length <= 1000 ? text : text.slice(0, 1000); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessage(value: unknown): boolean {
  return isRecord(value) && typeof value.id === "string" && (value.role === "user" || value.role === "assistant") && typeof value.text === "string";
}

function validDate(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}
