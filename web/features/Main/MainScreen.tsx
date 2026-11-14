"use client";
// The main screen: Today, Talk and Path under the floating glass tab bar (web/shared/GlassTabBar.tsx). Talk is the
// main page; the written conversation (the Ask screen) is a sheet over it. Port of
// ios/Sisu/Features/Main/MainScreen.swift.
// - The current tab is shown in one stacked container; the tab bar sits outside it, so it keeps its state (and
//   its springing pill) while the screens under it change. As on iOS only the current tab is mounted.
// - Each screen reserves the bar's room under its last row itself (web/shared/Screen.tsx, --sisu-tabbar-room);
//   while the on-screen keyboard is up the bar steps aside and that room is given back.
// - The conversation sheet (model.conversationShown), the evidence sheet (model.evidence) and the Rive celebration
//   (model.celebration) sit on top. The evidence sheet opened from inside the conversation stacks over it (it is
//   mounted later), so the transactions behind any figure open there too.
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { AppTab } from "@/web/app/AppTypes";
import { BottomSheet } from "@/web/shared/BottomSheet";
import { GlassTabBar } from "@/web/shared/GlassTabBar";
import { useKeyboardShown } from "@/web/shared/keyboard";
import TodayScreen from "@/web/features/Today/TodayScreen";
import TalkScreen from "@/web/features/Talk/TalkScreen";
import AskScreen from "@/web/features/Ask/AskScreen";
import PathScreen from "@/web/features/Path/PathScreen";
import { TransactionsSheet } from "@/web/features/Sheets/TransactionsSheet";
import { CelebrationOverlay } from "./CelebrationOverlay";
import "./main.css";

function TabContent({ tab }: { tab: AppTab }) {
  switch (tab) {
    case "today": return <TodayScreen />;
    case "talk": return <TalkScreen />;
    case "path": return <PathScreen />;
  }
}

export default function MainScreen() {
  const model = useAppModel();
  const tab = useAppSelector((s) => s.tab);
  const evidence = useAppSelector((s) => s.evidence);
  const celebration = useAppSelector((s) => s.celebration);
  const conversationShown = useAppSelector((s) => s.conversationShown);
  // The tab bar steps aside while the keyboard is up, so it never floats above the keys.
  const keyboardShown = useKeyboardShown();

  return (
    <div className="sisu-main" data-keyboard={keyboardShown ? "true" : "false"} data-testid="main" data-tab={tab}
      data-conversation={conversationShown ? "true" : "false"}>
      <div className="sisu-main-tabs" aria-hidden={conversationShown || undefined}>
        <TabContent tab={tab} />
      </div>
      <GlassTabBar selection={tab} onSelect={(next) => model.setTab(next)} tabs={AppTab.allCases} hidden={keyboardShown} />
      <ConversationSheet open={conversationShown} onClose={() => model.setConversationShown(false)} />
      <TransactionsSheet request={evidence} onClose={() => model.setEvidence(null)} />
      <CelebrationOverlay celebration={celebration} onDismiss={() => model.clearCelebration()} />
    </div>
  );
}

/** The written conversation over Talk: the Ask screen with a close button (Swift `ConversationSheet`). */
function ConversationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} scroll={false} ariaLabel="Conversation" testId="conversation.sheet">
      <div className="sisu-main-conversation">
        <AskScreen title="Conversation" onClose={onClose} />
      </div>
    </BottomSheet>
  );
}
