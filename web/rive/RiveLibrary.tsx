"use client";
// Loads each .riv file once and shares it with every RiveComponent. Port of ios/Sisu/Rive/RiveLibrary.swift.
//
// - One provider for the whole app (<RiveProvider> near the root, inside the "sisu-root" element).
// - The file is fetched the first time the provider mounts and then kept for as long as it is mounted.
// - A failed load is remembered: every component of that file shows its placeholder; nothing retries.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useRiveFile, type RiveFile } from "@rive-app/react-canvas";
import { riveFileURL, type RiveFileName } from "./contract";

/** What is known about a file right now (RiveLibrary.Status). */
export type RiveLibraryStatus =
  | { kind: "notRequested" }
  | { kind: "loading" }
  | { kind: "available"; file: RiveFile }
  | { kind: "unavailable"; reason: string };

interface RiveLibraryValue {
  status(file: RiveFileName): RiveLibraryStatus;
}

const RiveLibraryContext = createContext<RiveLibraryValue | null>(null);

const SISU_UI = { src: riveFileURL.sisu_ui };

/** Loads public/rive/sisu_ui.riv once and shares it. Wrap the app (and the lab page) in it. */
export function RiveProvider({ children }: { children: ReactNode }) {
  const { riveFile, status } = useRiveFile(SISU_UI);
  const value = useMemo<RiveLibraryValue>(() => {
    const current: RiveLibraryStatus =
      status === "success" && riveFile
        ? { kind: "available", file: riveFile }
        : status === "failed"
          ? { kind: "unavailable", reason: `${SISU_UI.src} could not be loaded` }
          : { kind: "loading" };
    if (status === "failed") logOnce(`[Rive] ${SISU_UI.src} is unavailable`);
    return {
      status: (file) => (file === "sisu_ui" ? current : { kind: "unavailable", reason: `unknown file ${file}` }),
    };
  }, [riveFile, status]);
  return <RiveLibraryContext.Provider value={value}>{children}</RiveLibraryContext.Provider>;
}

/** The status of a file, from the nearest RiveProvider. Without a provider the file counts as unavailable. */
export function useRiveLibraryStatus(file: RiveFileName): RiveLibraryStatus {
  const library = useContext(RiveLibraryContext);
  if (!library) {
    logOnce("[Rive] RiveComponent is used outside <RiveProvider>; drawing placeholders");
    return { kind: "unavailable", reason: "no RiveProvider" };
  }
  return library.status(file);
}

const logged = new Set<string>();

function logOnce(message: string) {
  if (process.env.NODE_ENV === "production" || logged.has(message)) return;
  logged.add(message);
  console.warn(message);
}
