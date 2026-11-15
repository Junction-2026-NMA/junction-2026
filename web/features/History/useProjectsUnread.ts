"use client";
// Whether a saved project (a watch) has findings the person has not read yet: the small dot on the Sisu logo.
// Stub for the Projects stream: replace the body with a read of its store (for example
// `useSyncExternalStore(projects.subscribe, () => projects.getSnapshot().unreadCount > 0)`). Until then: no dot.
export function useProjectsUnread(): boolean {
  return false;
}
