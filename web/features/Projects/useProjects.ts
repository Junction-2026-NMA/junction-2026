"use client";
// React hooks over the ProjectStore of the current coach session (web/app/ProjectStore.ts). Every hook attaches the
// store while mounted, so the 60 s check runs as long as something on screen shows projects (the Sisu logo's dot
// is enough).
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useAppModel, useCoachSession } from "@/web/app/AppProvider";
import { ProjectStore, type ProjectsState } from "@/web/app/ProjectStore";

const noSubscribe = () => () => {};
const noSnapshot = () => null;

/** The store of the current customer's session, or null before a customer is chosen. */
export function useProjectStore(): ProjectStore | null {
  const session = useCoachSession();
  const model = useAppModel();
  return useMemo(() => (session ? ProjectStore.forSession(session, model.launch.defaults) : null), [session, model]);
}

/** The store and its snapshot (null before a customer is chosen); attaches the store while mounted. */
export function useProjects(): { store: ProjectStore | null; state: ProjectsState | null } {
  const store = useProjectStore();
  const state = useSyncExternalStore(store ? store.subscribe : noSubscribe, store ? store.getSnapshot : noSnapshot, noSnapshot);
  useEffect(() => (store ? store.attach() : undefined), [store]);
  return { store, state };
}

/** Unread findings across every project: for the dot on the Sisu logo (0 when there are none or no customer). */
export function useProjectsUnread(): number {
  const { state } = useProjects();
  return state ? ProjectStore.unreadCount(state) : 0;
}
