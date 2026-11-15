"use client";
// A screen's scaffold: an optional fixed header, then the scroll view. Its last row scrolls clear of the floating
// tab bar: the web side of MainScreen's bottom safeAreaBar (bar height + 2 grid + lift above the safe area).
// The document never scrolls (web/gate/shell.css), so every screen scrolls inside this container.
//
//     <Screen header={<TodayHeader />} scrollRef={ref}>
//       <SisuCard>...</SisuCard>
//     </Screen>
//
// `ScreenStack` is the VStack inside the ScrollView: 20 px side margins, 16 px between rows.
import type { CSSProperties, ReactNode, Ref } from "react";
import "./screen.css";

export interface ScreenProps {
  children: ReactNode;
  /** Stays above the scroll view (a fixed header). */
  header?: ReactNode;
  /** Reserve room for the floating tab bar (default true). False for onboarding, the picker and sheets. */
  tabBar?: boolean;
  /** Pad the top for the status bar (env(safe-area-inset-top)). Default true. */
  safeTop?: boolean;
  /** The scroll container, for scrollTo / scrollIntoView (ScrollViewReader). */
  scrollRef?: Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

export function Screen({ children, header, tabBar = true, safeTop = true, scrollRef, className, style, testId }: ScreenProps) {
  return (
    <div
      className={className ? `sisu-screen ${className}` : "sisu-screen"}
      data-tabbar={tabBar ? "true" : "false"}
      data-safe-top={safeTop ? "true" : "false"}
      style={style}
      data-testid={testId}
    >
      {header ? <div className="sisu-screen-header">{header}</div> : null}
      <div className="sisu-screen-scroll" ref={scrollRef}>
        {children}
        <div className="sisu-screen-clearance" aria-hidden="true" />
      </div>
    </div>
  );
}

/** The column of a screen: side margins and the 16 px gap between cards. */
export function ScreenStack({ children, gap, className, style }: {
  children: ReactNode;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const own: CSSProperties = gap === undefined ? {} : { gap };
  return (
    <div className={className ? `sisu-screen-stack ${className}` : "sisu-screen-stack"} style={{ ...own, ...style }}>
      {children}
    </div>
  );
}
