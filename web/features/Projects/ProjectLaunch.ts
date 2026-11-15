"use client";
// `?project=<watch id>`: opens that project on the Sisu tab once a customer is shown (a deep link for the demo
// and for screenshots). Call `useProjectLaunch()` once where the Sisu tab is mounted.
// v2 push: a tap on a notification while the app is open arrives as a service worker message
// { type: "open-project", customerId, projectId } (public/sw.js): the customer is switched if needed, then the
// project opens. With the app closed the notification opens /app?...&customer=&project=, handled as above.
import { useEffect, useRef } from "react";
import { useAppModel, useAppSelector } from "@/web/app/AppProvider";
import { launchQuery, launchValue } from "@/web/app/LaunchOptions";
import { registerWorker } from "@/web/app/Push";

export const ProjectLaunch = {
  /** The watch id named by `?project=`, or null. */
  parse(query: URLSearchParams): string | null {
    const id = launchValue(query, "project")?.trim() ?? "";
    return id !== "" && id.length <= 80 ? id : null;
  },
  current(): string | null { return ProjectLaunch.parse(launchQuery()); },
  /** A service worker message that asks to open a project, or null. */
  message(data: unknown): { customerId: string | null; projectId: string } | null {
    const o = data as { type?: unknown; customerId?: unknown; projectId?: unknown } | null;
    if (!o || o.type !== "open-project" || typeof o.projectId !== "string" || o.projectId === "" || o.projectId.length > 80) return null;
    return { customerId: typeof o.customerId === "string" && o.customerId !== "" ? o.customerId : null, projectId: o.projectId };
  },
} as const;

/** Opens the `?project=` project once, after the customer's overview has loaded, and every project a notification
 *  tap asks for while the app is open. */
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
    model.setOpenProjectId(id);
  }, [ready, model]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void registerWorker();
    const onMessage = (event: MessageEvent) => {
      const asked = ProjectLaunch.message(event.data);
      if (!asked) return;
      void (async () => {
        const wanted = asked.customerId ? model.getSnapshot().customers.find((c) => c.customerId === asked.customerId) : undefined;
        if (wanted && model.getSnapshot().customer?.customerId !== wanted.customerId) await model.choose(wanted);
        model.setTab("sisu");
        model.setOpenProjectId(asked.projectId);
      })();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [model]);
}
