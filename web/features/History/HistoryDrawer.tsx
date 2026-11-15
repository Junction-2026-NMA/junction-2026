"use client";
// The chat history drawer of the Sisu tab, opened by the Sisu logo: New chat, the previous conversations of this
// customer (kept on this device, web/core/ConversationHistory.ts; opening one puts it back into the session with its
// context), the saved projects (web/features/Projects) and, at the bottom, Settings. A modal panel from the left:
// focus moves into it, Tab stays inside, Escape or the scrim closes it and focus goes back to the logo.
import { useEffect, useRef, type RefObject } from "react";
import { useAppModel, useCoach } from "@/web/app/AppProvider";
import { ConversationHistory } from "@/web/core/ConversationHistory";
import { ProjectsSection } from "@/web/features/Projects/ProjectsSection";
import { PencilSquareIcon } from "@/web/features/Talk/TalkParts";
import "./history.css";

export function HistoryDrawer({ open, onClose, onSettings, returnFocus }: {
  open: boolean;
  onClose: () => void;
  /** The Settings row: the drawer closes and the Settings sheet opens. */
  onSettings: () => void;
  /** Where focus goes when the drawer closes (the logo button). */
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const model = useAppModel();
  const coach = useCoach();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  const conversations = coach.savedConversations;
  const current = coach.conversationId;
  const now = new Date();

  // Focus in on open, back to the logo on close.
  useEffect(() => {
    if (open && !wasOpen.current) window.setTimeout(() => closeButton.current?.focus({ preventScroll: true }), 30);
    if (!open && wasOpen.current) returnFocus.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open, returnFocus]);

  // Escape closes; Tab stays inside the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"));
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const newChat = () => {
    model.coach.newConversation();
    onClose();
  };
  const openConversation = (id: string) => {
    model.coach.openConversation(id);
    onClose();
  };

  return (
    <div className="sisu-history" data-open={open ? "true" : "false"} inert={!open} aria-hidden={!open || undefined} data-testid="history.layer">
      <div className="sisu-history-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={panel} id="sisu-history" className="sisu-history-panel" role="dialog" aria-modal="true" aria-labelledby="sisu-history-title"
        data-testid="history.drawer">
        <header className="sisu-history-header">
          <h2 className="sisu-history-title" id="sisu-history-title">Chat history</h2>
          <button ref={closeButton} type="button" className="sisu-history-close" aria-label="Close chat history" data-testid="history.close" onClick={onClose}>
            <CloseGlyph />
          </button>
        </header>
        <div className="sisu-history-scroll">
          <button type="button" className="sisu-history-new" data-testid="history.new" onClick={newChat}>
            <PencilSquareIcon />
            <span>New chat</span>
          </button>

          <section className="sisu-history-section" aria-labelledby="sisu-history-chats">
            <h3 className="sisu-history-head" id="sisu-history-chats">Previous conversations</h3>
            {conversations.length === 0 ? (
              <p className="sisu-history-empty">Your conversations with Sisu are kept here, on this device.</p>
            ) : (
              <ul className="sisu-history-list">
                {conversations.map((c, index) => {
                  const count = ConversationHistory.questionCount(c);
                  const isCurrent = c.id === current;
                  return (
                    <li key={c.id}>
                      <button type="button" className="sisu-history-item" data-current={isCurrent ? "true" : "false"}
                        aria-current={isCurrent ? "true" : undefined} data-testid={`history.item.${index}`} onClick={() => openConversation(c.id)}>
                        <span className="sisu-history-item-title">{c.title}</span>
                        <span className="sisu-history-item-meta">
                          {isCurrent ? "Open now · " : ""}{ConversationHistory.dateLabel(c.updatedAt, now)} · {count === 1 ? "1 question" : `${count} questions`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="sisu-history-section" aria-labelledby="sisu-history-projects">
            <h3 className="sisu-history-head" id="sisu-history-projects">Saved projects</h3>
            <div className="sisu-history-projects">
              <ProjectsSection onOpen={(id) => { model.setOpenProjectId(id); model.setHistoryOpen(false); }} />
            </div>
          </section>
        </div>
        <footer className="sisu-history-footer">
          <button type="button" className="sisu-history-settings" data-testid="history.settings" onClick={onSettings}>
            <GearGlyph />
            <span>Settings</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

/** A toothed cog (eight teeth around a hole), like the Settings buttons on Today and Path: not the Today tab's sun. */
function GearGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M8.19 4.07L8.70 1.80L11.30 1.80L11.81 4.07A6.2 6.2 0 0 1 12.91 4.53L14.88 3.29L16.71 5.12L15.47 7.09A6.2 6.2 0 0 1 15.93 8.19L18.20 8.70L18.20 11.30L15.93 11.81A6.2 6.2 0 0 1 15.47 12.91L16.71 14.88L14.88 16.71L12.91 15.47A6.2 6.2 0 0 1 11.81 15.93L11.30 18.20L8.70 18.20L8.19 15.93A6.2 6.2 0 0 1 7.09 15.47L5.12 16.71L3.29 14.88L4.53 12.91A6.2 6.2 0 0 1 4.07 11.81L1.80 11.30L1.80 8.70L4.07 8.19A6.2 6.2 0 0 1 4.53 7.09L3.29 5.12L5.12 3.29L7.09 4.53A6.2 6.2 0 0 1 8.19 4.07Z"
        fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
