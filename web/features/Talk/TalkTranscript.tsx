"use client";
// The Sisu conversation as a chat: each question (typed or spoken) and each answer with its cards (AssistantAnswer).
// Reading position comes first: a new question is scrolled to the top of the view once, and the answer then grows
// underneath it without the view moving (a spacer under the newest turn keeps it at least one view tall, so there is
// room; it shrinks as the answer grows, so the scroll height does not change under the reader). It never
// jumps to the bottom of a long answer and never fights the person's scrolling. When new content arrives below what is
// visible (more of the answer, a new card), a small round "Jump to latest" button at the bottom right brings the end
// into view; a Details section the person opens is not new content, and the button goes once the end is in view.
// Leaving the tab and coming back (the transcript remounts) returns to where the person was reading, per conversation.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { CoachStore } from "@/web/app/CoachStore";
import { CoachSession, type CoachMessage, type CoachSessionState } from "@/web/core/CoachSession";
import { Message, MessageContent } from "@/web/agents/Message";
import { UserBubble } from "@/web/features/Ask/AskParts";
import { AssistantAnswer } from "@/web/features/Ask/AssistantAnswer";
import { COACH_BOTTOM } from "@/web/features/Ask/askLaunch";

/** Space kept above a question scrolled to the top. */
const TOP_GAP = 12;
/** More than this much content below the visible area counts as out of view. */
const UNSEEN = 32;

/** Where each conversation was being read (by conversation id), kept when the transcript unmounts (a tab switch) so
 *  it comes back there. `questionId` is the newest question the view had been brought to. */
const readingPositions = new Map<string, { questionId: string | null; scrollTop: number }>();

export interface TranscriptHandle {
  /** Scroll so the element with `data-anchor={id}` sits at the top or the bottom (launch options). */
  scrollToAnchor: (id: string, anchor: "top" | "bottom") => boolean;
}

export function TalkTranscript({ session, state, store, conversationId, reduceMotion, onUserDrag, handle }: {
  session: CoachSession;
  state: CoachSessionState;
  store: CoachStore;
  /** The conversation on screen (CoachStore.conversationId): its reading position is kept across tab switches. */
  conversationId: string;
  reduceMotion: boolean;
  /** The person dragged the chat (lets the keyboard go). */
  onUserDrag?: () => void;
  handle?: (handle: TranscriptHandle) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const [viewHeight, setViewHeight] = useState(0);
  const [showJump, setShowJump] = useState(false);
  /** New content arrived while the end was out of view, and the end has not been in view since. */
  const unseen = useRef(false);
  /** The newest question the view has been brought to (null until the first one). */
  const shownQuestion = useRef<string | null>(null);
  const messages = state.messages;
  const lastQuestionIndex = findLastIndex(messages, (m) => m.role === "user");
  const lastQuestion = lastQuestionIndex >= 0 ? messages[lastQuestionIndex] : null;

  // Cards on screen when the chat appeared come without the entrance motion.
  const [initial] = useState(() => new Set(messages.flatMap((m) =>
    [m.id, ...m.stages.map((s) => `${m.id}/${s.id}`), ...m.visuals.map((v) => `${m.id}/visual/${v.id}`)])));
  const isNew = useCallback((id: string) => !initial.has(id), [initial]);

  /** Sizes the spacer under the newest turn (so its question can sit at the top), then decides the "Jump to latest"
   *  button: it shows only when content `arrived` while the end was out of view, and goes once the end is in view.
   *  Layout offsets only, so rows still rising in are measured where they land. */
  const measure = useCallback((arrived = false) => {
    const element = scroller.current, stack = content.current;
    if (!element || !stack) return;
    const rows = stack.querySelectorAll<HTMLElement>("[data-anchor]");
    const last = rows[rows.length - 1] ?? null;
    const questions = stack.querySelectorAll<HTMLElement>('[data-role="user"]');
    const question = questions[questions.length - 1] ?? null;
    if (!last) { unseen.current = false; setShowJump(false); return; }
    const end = offsetWithin(last, element) + last.offsetHeight;
    if (spacer.current) {
      const turn = question ? end - offsetWithin(question, element) : 0;
      const room = Math.max(0, element.clientHeight - TOP_GAP - turn - 24);
      if (spacer.current.style.height !== `${room}px`) spacer.current.style.height = `${room}px`;
    }
    const endOutOfView = end - (element.scrollTop + element.clientHeight) > UNSEEN;
    if (!endOutOfView) unseen.current = false;
    else if (arrived) unseen.current = true;
    setShowJump(unseen.current);
  }, []);

  const scrollToAnchor = useCallback((id: string, anchor: "top" | "bottom", smooth = false) => {
    const element = scroller.current;
    if (!element) return false;
    const target = Array.from(element.querySelectorAll<HTMLElement>("[data-anchor]")).find((node) => node.dataset.anchor === id);
    if (!target) return false;
    // Layout offsets, not the on-screen box: a row still rising in (its entrance transform) would be measured low.
    const offset = offsetWithin(target, element);
    const top = anchor === "top"
      ? offset - TOP_GAP
      : offset + target.offsetHeight - element.clientHeight + TOP_GAP;
    const goal = Math.max(0, Math.min(top, element.scrollHeight - element.clientHeight));
    if (Math.abs(goal - element.scrollTop) >= 1) element.scrollTo({ top: goal, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
    return true;
  }, [reduceMotion]);

  useEffect(() => { handle?.({ scrollToAnchor: (id, anchor) => scrollToAnchor(id, anchor) }); }, [handle, scrollToAnchor]);

  // The view's height: the newest turn is at least this tall, so its question can always sit at the top.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const read = () => setViewHeight(element.clientHeight);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { read(); measure(); });
    observer.observe(element);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [measure]);

  // Content arrived (an answer streaming in, a new card): the spacer and the button follow, never the position. A new
  // question is not "below": the view is about to bring it to the top. The view's own size changing is not new content.
  const newest = messages[messages.length - 1];
  const growth = newest ? `${messages.length}|${newest.text.length}|${newest.stages.length}|${newest.steps.length}|${newest.visuals.length}` : "";
  const lastGrowth = useRef(growth);
  useLayoutEffect(() => {
    if (growth === lastGrowth.current) return;
    lastGrowth.current = growth;
    measure((lastQuestion?.id ?? null) === shownQuestion.current);
  }, [growth, measure, lastQuestion?.id]);
  useLayoutEffect(() => { measure(); }, [measure, viewHeight, newest?.pending]);

  // On appearing: back where this conversation was being read (after a tab switch), else the newest question at the
  // top, at once. A new question: brought to the top once, smoothly.
  useLayoutEffect(() => {
    const id = lastQuestion?.id ?? null;
    const element = scroller.current;
    // Wait for the view's height: until then the spacer cannot make room to bring the question up.
    if (id === shownQuestion.current || viewHeight === 0 || !element) return;
    const first = shownQuestion.current === null;
    shownQuestion.current = id;
    measure();
    const saved = first ? readingPositions.get(conversationId) : undefined;
    if (saved && saved.questionId === id) element.scrollTop = Math.min(saved.scrollTop, element.scrollHeight - element.clientHeight);
    else if (id) scrollToAnchor(id, "top", !first);
    measure();
  }, [lastQuestion?.id, scrollToAnchor, viewHeight, measure, conversationId]);

  // The reading position, kept for when the transcript comes back (on every scroll, and when it goes).
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const save = () => {
      if (shownQuestion.current !== null) readingPositions.set(conversationId, { questionId: shownQuestion.current, scrollTop: element.scrollTop });
    };
    element.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      element.removeEventListener("scroll", save);
    };
  }, [conversationId]);

  // The person's own scrolling: the pill follows what is visible; a drag lets the keyboard go.
  const dragCallback = useRef(onUserDrag);
  useEffect(() => { dragCallback.current = onUserDrag; });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let startY = 0;
    const onScroll = () => measure();
    const touchStart = (event: TouchEvent) => { startY = event.touches[0]?.clientY ?? 0; };
    const touchMove = (event: TouchEvent) => {
      if (Math.abs((event.touches[0]?.clientY ?? startY) - startY) >= 8) dragCallback.current?.();
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("touchstart", touchStart, { passive: true });
    element.addEventListener("touchmove", touchMove, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
    };
  }, [measure]);

  const jumpToLatest = () => {
    const element = scroller.current, rows = content.current?.querySelectorAll<HTMLElement>("[data-anchor]");
    const last = rows?.[rows.length - 1];
    if (!element || !last) return;
    const bottom = offsetWithin(last, element) + last.offsetHeight;
    element.scrollTo({ top: Math.max(0, bottom - element.clientHeight + 24), behavior: reduceMotion ? "auto" : "smooth" });
  };

  /** Asks the question of a failed answer again. A voice question that was never heard cannot be typed for the
   *  person: Sisu listens for it again instead. */
  const retry = (reply: CoachMessage) => {
    const all = session.getSnapshot().messages;
    const index = all.findIndex((m) => m.id === reply.id);
    if (index <= 0) return;
    const question = all[index - 1].text;
    if (CoachSession.isUnheard(question)) store.conversation?.listenForAgain();
    else if (question === CoachSession.investigateText) store.investigate();
    else store.ask(question);
  };

  // Each turn is a beUI Message row (web/agents): a new one pops up from the live edge, one already on screen when
  // the chat appeared does not move.
  const row = (message: CoachMessage): ReactNode => (
    <Message key={message.id} from={message.role === "user" ? "user" : "assistant"} animateIn={isNew(message.id)}
      data-anchor={message.id} data-role={message.role}>
      <MessageContent>
        {message.role === "user"
          ? <UserBubble text={message.text} pending={message.pending} spoken={message.spoken === true} animateIn={isNew(message.id)} />
          : <AssistantAnswer message={message} actions={state.actions} retry={() => retry(message)} isNew={isNew} />}
      </MessageContent>
    </Message>
  );

  return (
    <div className="sisu-talk-transcript">
      <div className="sisu-talk-scroll" ref={scroller} data-testid="talk.transcript">
        <div className="sisu-talk-stack" ref={content}>
          {messages.map(row)}
        </div>
        <div className="sisu-talk-spacer" ref={spacer} aria-hidden="true" />
        <div className="sisu-talk-bottom" data-anchor={COACH_BOTTOM} aria-hidden="true" />
      </div>
      {showJump ? (
        <button type="button" className="sisu-talk-jump" onClick={jumpToLatest} data-testid="talk.jump" aria-label="Jump to latest" title="Jump to latest">
          <DownArrow />
        </button>
      ) : null}
    </div>
  );
}

/** The top of `node` inside the scroll content of `scroller` (the scroller is its offsetParent chain's end). */
function offsetWithin(node: HTMLElement, scroller: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = node;
  while (current && current !== scroller) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return top;
}

function findLastIndex<T>(items: readonly T[], test: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) if (test(items[index])) return index;
  return -1;
}

function DownArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M7 2.5v8.2M3.2 7.2 7 11l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
