"use client";

import dynamic from "next/dynamic";

/** Shown while the app bundle loads: the plain near-white launch background, like the iOS launch screen. */
export function LaunchScreen() {
  return <div className="sisu-launch" aria-busy="true" aria-label="Sisu is loading" />;
}

/** The app root, loaded only in the browser (it uses window, audio, canvas and storage). */
const SisuApp = dynamic(() => import("@/web/app/SisuApp"), { ssr: false, loading: () => <LaunchScreen /> });

export default function AppLoader() {
  return <SisuApp />;
}
