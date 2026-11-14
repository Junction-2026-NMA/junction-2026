"use client";
// The main screen: the four tabs under the floating glass tab bar (web/shared/GlassTabBar.tsx). Port of
// ios/Sisu/Features/Main/MainScreen.swift.
// - The current tab is shown in one stacked container; the tab bar sits outside it, so it keeps its state (and
//   its springing pill) while the screens under it change. As on iOS only the current tab is mounted.
// - Each screen reserves the bar's room under its last row itself (web/shared/Screen.tsx, --sisu-tabbar-room);
//   while the on-screen keyboard is up the bar steps aside and that room is given back.
// - The evidence sheet (model.evidence) and the Rive celebration (model.celebration) sit on top.
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { AppTab } from "@/web/app/AppTypes";
import { GlassTabBar } from "@/web/shared/GlassTabBar";
import { useKeyboardShown } from "@/web/shared/keyboard";
import TodayScreen from "@/web/features/Today/TodayScreen";
import AskScreen from "@/web/features/Ask/AskScreen";
import JarsScreen from "@/web/features/Jars/JarsScreen";
import PathScreen from "@/web/features/Path/PathScreen";
import { TransactionsSheet } from "@/web/features/Sheets/TransactionsSheet";
import { CelebrationOverlay } from "./CelebrationOverlay";
import "./main.css";

function TabContent({ tab }: { tab: AppTab }) {
  switch (tab) {
    case "today": return <TodayScreen />;
    case "ask": return <AskScreen />;
    case "jars": return <JarsScreen />;
    case "path": return <PathScreen />;
  }
}

export default function MainScreen() {
  const model = useAppModel();
  const tab = useAppSelector((s) => s.tab);
  const evidence = useAppSelector((s) => s.evidence);
  const celebration = useAppSelector((s) => s.celebration);
  // The tab bar steps aside while the keyboard is up, so it never floats above the keys.
  const keyboardShown = useKeyboardShown();

  return (
    <div className="sisu-main" data-keyboard={keyboardShown ? "true" : "false"} data-testid="main" data-tab={tab}>
      <div className="sisu-main-tabs">
        <TabContent tab={tab} />
      </div>
      <GlassTabBar selection={tab} onSelect={(next) => model.setTab(next)} tabs={AppTab.allCases} hidden={keyboardShown} />
      <TransactionsSheet request={evidence} onClose={() => model.setEvidence(null)} />
      <CelebrationOverlay celebration={celebration} onDismiss={() => model.clearCelebration()} />
    </div>
  );
}
