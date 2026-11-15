"use client";
// `?project=<watch id>&finding=<finding id>`: opens that project on the Sisu tab once a customer is shown, scrolled to
// that finding (a deep link for the demo, and the address a tapped phone notification opens). A tapped notification
// while the app is already open arrives as the service worker's "sisu-open" message and does the same.
// Call `useProjectLaunch()` once where the Sisu tab is mounted (MainScreen).
import { useEffect, useRef } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { launchQuery } from "@/web/app/LaunchOptions";
import { isOpenMessage, registerWorker } from "@/web/core/Push";
import { parseProjectLink } from "./ProjectJourney";
import { useProjectStore } from "./useProjects";

export const ProjectLaunch = {
  /** The watch id named by `?project=`, or null. */
  parse(query: URLSearchParams): string | null { return parseProjectLink(query)?.project ?? null; },
  link(query: URLSearchParams) { return parseProjectLink(query); },
  current(): string | null { return ProjectLaunch.parse(launchQuery()); },
} as const;

/** Opens the `?project=` project once, after the customer's overview has loaded; also on a notification tap. */
export function useProjectLaunch(): void {
  const model = useAppModel();
  const store = useProjectStore();
  const ready = useAppSelector((s) => s.customer !== null && s.overviewState.kind === "loaded");
  const done = useRef(false);

  useEffect(() => {
    if (!ready || done.current || !store) return;
    done.current = true;
    const link = ProjectLaunch.link(launchQuery());
    if (!link) return;
    model.setTab("sisu");
    model.setHistoryOpen(false);
    model.setOpenProjectId(link.project);
    store.focusFinding(link.project, link.finding);
  }, [ready, model, store]);

  useEffect(() => {
    void registerWorker();
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !store) return;
    const onMessage = (event: MessageEvent) => {
      if (!isOpenMessage(event.data)) return;
      const link = parseProjectLink(new URL(event.data.url, window.location.origin).searchParams);
      if (!link) return;
      model.setTab("sisu");
      model.setHistoryOpen(false);
      model.setOpenProjectId(link.project);
      store.focusFinding(link.project, link.finding);
      void store.load();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [model, store]);
}
