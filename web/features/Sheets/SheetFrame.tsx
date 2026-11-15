"use client";
// A sheet's frame: the near-white screen colour, a title and a close button, the grabber, 32 px corners.
// Port of SheetFrame in ios/Sisu/Features/Sheets/Sheets.swift over web/shared/BottomSheet.
import type { ReactNode } from "react";
import { BottomSheet, type SheetDetent } from "@/web/shared/BottomSheet";
import { SisuIconButton } from "@/web/shared/SisuStyle";
import "./sheets.css";

export function SheetFrame({ open, onClose, title, detents = ["large"], scroll = true, onClosed, testId, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  detents?: readonly SheetDetent[];
  /** False when the content scrolls itself (a fixed part above a list). */
  scroll?: boolean;
  onClosed?: () => void;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} detents={detents} scroll={scroll} onClosed={onClosed}
      ariaLabel={title} testId={testId}
      header={
        <div className="sisu-sheet-title-row">
          <h2 className="sisu-sheet-title">{title}</h2>
          <SisuIconButton icon="close" style="tinted" label="Close" action={onClose} />
        </div>
      }>
      {children}
    </BottomSheet>
  );
}
