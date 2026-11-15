"use client";
// `?project=<watch id>`: opens that project on the Sisu tab once a customer is shown (a deep link for the demo
// and for screenshots). Call `useProjectLaunch()` once where the Sisu tab is mounted.
import { useEffect, useRef } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { launchQuery, launchValue } from "@/web/app/LaunchOptions";

export const ProjectLaunch = {
  /** The watch id named by `?project=`, or null. */
  parse(query: URLSearchParams): string | null {
    const id = launchValue(query, "project")?.trim() ?? "";
    return id !== "" && id.length <= 80 ? id : null;
  },
  current(): string | null { return ProjectLaunch.parse(launchQuery()); },
} as const;

/** Opens the `?project=` project once, after the customer's overview has loaded. */
export function useProjectLaunch(): void {
  const model = useAppModel();
  const ready = useAppSelector((s) => s.customer !== null && s.overviewState.kind === "loaded");
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    const id = ProjectLaunch.current();
    if (!id) return;
    model.setTab("sisu");
    model.setConversationShown(false);
    model.setOpenProjectId(id);
  }, [ready, model]);
}
