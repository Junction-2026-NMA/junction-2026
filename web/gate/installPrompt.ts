// Captures Chrome/Edge/Samsung's beforeinstallprompt as early as possible (at module load),
// so the one-tap "Install" button works even if the event fires before React renders the steps.
// Exposed as a subscribe/getSnapshot pair for useSyncExternalStore.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type InstallPromptState = "unavailable" | "available" | "installed";

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallPromptState = "unavailable";
const listeners = new Set<() => void>();

function setState(next: InstallPromptState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    setState("available");
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    setState("installed");
  });
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInstallPromptState(): InstallPromptState {
  return state;
}

export function getServerInstallPromptState(): InstallPromptState {
  return "unavailable";
}

/** Shows the browser's install dialog. Resolves to true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const choice = await event.userChoice;
  setState(choice.outcome === "accepted" ? "installed" : "unavailable");
  return choice.outcome === "accepted";
}
