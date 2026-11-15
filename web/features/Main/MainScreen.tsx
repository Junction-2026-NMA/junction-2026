"use client";
// The main screen: Today, Sisu and Path under the floating glass tab bar (web/shared/GlassTabBar.tsx). Sisu (the
// conversation, typed and spoken, web/features/Talk) is the main page. Port of ios/Sisu/Features/Main/MainScreen.swift.
// - The current tab is shown in one stacked container; the tab bar sits outside it, so it keeps its state (and
//   its springing pill) while the screens under it change. As on iOS only the current tab is mounted.
// - Each screen reserves the bar's room under its last row itself (web/shared/Screen.tsx, --sisu-tabbar-room);
//   while the on-screen keyboard is up the bar steps aside and that room is given back.
// - The evidence sheet (model.evidence) and the Rive celebration (model.celebration) sit on top, so the
//   transactions behind any figure open over the conversation too.
// - Projects (web/features/Projects) are checked while any tab is shown (useProjectsPolling), and `?project=<id>`
//   opens one on the Sisu tab (useProjectLaunch). Both run here once, because MainScreen stays mounted.
// - Nothing here paints a background: the app-wide texture under .sisu-root shows through.
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { AppTab } from "@/web/app/AppTypes";
import { GlassTabBar } from "@/web/shared/GlassTabBar";
import { useKeyboardShown } from "@/web/shared/keyboard";
import TodayScreen from "@/web/features/Today/TodayScreen";
import TalkScreen from "@/web/features/Talk/TalkScreen";
import PathScreen from "@/web/features/Path/PathScreen";
import { TransactionsSheet } from "@/web/features/Sheets/TransactionsSheet";
import { useProjectLaunch } from "@/web/features/Projects/ProjectLaunch";
import { useProjectsPolling } from "@/web/features/Projects/useProjects";
import { CelebrationOverlay } from "./CelebrationOverlay";
import "./main.css";

function TabContent({ tab }: { tab: AppTab }) {
  switch (tab) {
    case "today": return <TodayScreen />;
    case "sisu": return <TalkScreen />;
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
  useProjectsPolling();
  useProjectLaunch();

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
