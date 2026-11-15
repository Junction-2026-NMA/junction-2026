"use client";
// The winding path of lesson nodes: PathTrail and LessonNodeView in ios/Sisu/Features/Path/PathScreen.swift.
// Each node is a Rive Sticker (kind `lesson`) with its badge; the current one has a green ring, the Rive "Start"
// tag above it and Liito beside it; done ones carry a check; locked ones are faded with a lock and, when tapped,
// say which lesson comes first.
import { useLayoutEffect, useRef } from "react";
import type { TeachingCard } from "@/web/core/CoachModels";
import { LessonNode } from "@/web/core/AppLogic/LessonPath";
import { RiveBindings } from "@/web/core/RiveContract";
import { RiveComponent } from "@/web/rive/RiveComponent";
import type { PathModel, PathSnapshot } from "./PathModel";
import { LockGlyph } from "./PathStates";

/** How far a node swings left or right at the widest point of the curve. */
const SWING = 84;

export function PathTrail({ path, snapshot, open }: {
  path: PathModel;
  snapshot: PathSnapshot;
  open: (card: TeachingCard) => void;
}) {
  const column = useRef<HTMLDivElement>(null);
  const nodes = path.nodes;

  // On appear: bring the current lesson to the middle when it is further down than the third.
  useLayoutEffect(() => {
    const current = nodes.find((node) => node.state === "current");
    const scroller = column.current?.closest<HTMLElement>(".sisu-screen-scroll");
    if (!current || current.index <= 2 || !scroller) return;
    const element = scroller.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(current.id)}"]`);
    if (!element) return;
    const box = element.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    scroller.scrollTop += box.top + box.height / 2 - (view.top + view.height / 2);
    // Once, like the Swift `.task` of the trail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={column} className="sisu-path-trail">
      {nodes.map((node) => {
        const card = snapshot.cards.find((c) => c.concept === node.concept);
        if (!card) return null;
        return (
          <LessonNodeView key={node.id} node={node} total={snapshot.cards.length} open={() => open(card)} />
        );
      })}
    </div>
  );
}

function LessonNodeView({ node, total, open }: { node: LessonNode; total: number; open: () => void }) {
  const current = node.state === "current";
  return (
    <button
      type="button"
      className="sisu-path-node"
      data-state={node.state}
      data-node-id={node.id}
      data-testid={`lesson.${node.index + 1}`}
      aria-label={LessonNode.accessibilityLabel(node, total)}
      aria-disabled={node.state === "locked" || undefined}
      style={{ transform: `translateX(${node.sway * SWING}px)` }}
      onClick={open}
    >
      {current ? (
        <span aria-hidden="true" className="sisu-path-node-tag">
          <RiveComponent component="Tag" values={RiveBindings.tag("Start", "neutral")} />
        </span>
      ) : null}
      <span className="sisu-path-node-badge" aria-hidden="true">
        <span className="sisu-path-node-sticker">
          <RiveComponent component="Sticker" values={RiveBindings.sticker("lesson", node.badge)}
            sizing="contain" style={{ width: 96, height: 96 }} />
        </span>
        {node.state === "done" ? (
          <span className="sisu-path-node-check">
            <CheckGlyph />
          </span>
        ) : node.state === "locked" ? (
          <span className="sisu-path-node-lock">
            <LockGlyph />
          </span>
        ) : null}
        {current ? (
          <span className="sisu-path-node-liito" data-side={node.sway > 0 ? "leading" : "trailing"}>
            <RiveComponent component="Liito" values={RiveBindings.liito("idle")}
              sizing="contain" style={{ width: 104, height: 104 }} />
          </span>
        ) : null}
      </span>
      <span className="sisu-path-node-title" aria-hidden="true">{node.title}</span>
    </button>
  );
}

/** SF Symbol `checkmark` at the label size. */
function CheckGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7.4 5.6 10.4 11.5 3.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
