"use client";
// The Sisu conversation as a chat: each question (typed or spoken) and each answer with its cards (AssistantAnswer).
// Reading position comes first: a new question is scrolled to the top of the view once, and the answer then grows
// underneath it without the view moving (a spacer under the newest turn keeps it at least one view tall, so there is
// room; it shrinks as the answer grows, so the scroll height does not change under the reader). It never
// jumps to the bottom of a long answer and never fights the person's scrolling. When there is more below what is
// visible, a "Jump to latest" pill brings the end into view.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { CoachStore } from "@/web/app/CoachStore";
import { CoachSession, type CoachMessage, type CoachSessionState } from "@/web/core/CoachSession";
import { SisuMotion } from "@/web/shared/SisuStyle";
import { UserBubble } from "@/web/features/Ask/AskParts";
import { AssistantAnswer } from "@/web/features/Ask/AssistantAnswer";
import { COACH_BOTTOM } from "@/web/features/Ask/askLaunch";

/** Space kept above a question scrolled to the top. */
const TOP_GAP = 12;
/** More than this much content below the visible area shows the pill. */
const UNSEEN = 32;

export interface TranscriptHandle {
  /** Scroll so the element with `data-anchor={id}` sits at the top or the bottom (launch options). */
  scrollToAnchor: (id: string, anchor: "top" | "bottom") => boolean;
}

export function TalkTranscript({ session, state, store, reduceMotion, onUserDrag, handle }: {
  session: CoachSession;
  state: CoachSessionState;
  store: CoachStore;
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
  const messages = state.messages;
  const lastQuestionIndex = findLastIndex(messages, (m) => m.role === "user");
  const lastQuestion = lastQuestionIndex >= 0 ? messages[lastQuestionIndex] : null;

  // Cards on screen when the chat appeared come without the entrance motion.
  const [initial] = useState(() => new Set(messages.flatMap((m) =>
    [m.id, ...m.stages.map((s) => `${m.id}/${s.id}`), ...m.visuals.map((v) => `${m.id}/visual/${v.id}`)])));
  const isNew = useCallback((id: string) => !initial.has(id), [initial]);

  /** Sizes the spacer under the newest turn (so its question can sit at the top), then says whether there is content
   *  below the visible area (the pill). Layout offsets only, so rows still rising in are measured where they land. */
  const measure = useCallback(() => {
    const element = scroller.current, stack = content.current;
    if (!element || !stack) return;
    const rows = stack.querySelectorAll<HTMLElement>("[data-anchor]");
    const last = rows[rows.length - 1] ?? null;
    const questions = stack.querySelectorAll<HTMLElement>('[data-role="user"]');
    const question = questions[questions.length - 1] ?? null;
    if (!last) { setShowJump(false); return; }
    const end = offsetWithin(last, element) + last.offsetHeight;
    if (spacer.current) {
      const turn = question ? end - offsetWithin(question, element) : 0;
      const room = Math.max(0, element.clientHeight - TOP_GAP - turn - 24);
      if (spacer.current.style.height !== `${room}px`) spacer.current.style.height = `${room}px`;
    }
    setShowJump(end - (element.scrollTop + element.clientHeight) > UNSEEN);
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

  // Content grew (an answer streaming in): the spacer and the pill follow, never the position.
  const newest = messages[messages.length - 1];
  const growth = newest ? `${messages.length}|${newest.text.length}|${newest.stages.length}|${newest.steps.length}|${newest.visuals.length}|${newest.pending ? 1 : 0}` : "";
  useLayoutEffect(() => { measure(); }, [growth, measure, viewHeight]);

  // On appearing: the newest question at the top, at once. A new question: brought to the top once, smoothly.
  const shownQuestion = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = lastQuestion?.id ?? null;
    // Wait for the view's height: until then the spacer cannot make room to bring the question up.
    if (id === shownQuestion.current || viewHeight === 0) return;
    const first = shownQuestion.current === null;
    shownQuestion.current = id;
    measure();
    if (id) scrollToAnchor(id, "top", !first);
  }, [lastQuestion?.id, scrollToAnchor, viewHeight, measure]);

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

  const enter = (id: string) => (isNew(id) ? SisuMotion.entrance(reduceMotion) : undefined);
  const row = (message: CoachMessage): ReactNode => (
    <div key={message.id} data-anchor={message.id} data-role={message.role} className={enter(message.id)}>
      {message.role === "user"
        ? <UserBubble text={message.text} pending={message.pending} spoken={message.spoken === true} />
        : <AssistantAnswer message={message} actions={state.actions} retry={() => retry(message)} isNew={isNew} />}
    </div>
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
        <button type="button" className="sisu-talk-jump" onClick={jumpToLatest} data-testid="talk.jump">
          <DownArrow /> Jump to latest
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
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M7 2.5v8.2M3.2 7.2 7 11l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
