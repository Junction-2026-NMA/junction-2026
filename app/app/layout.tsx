import type { Metadata, Viewport } from "next";
import { sisuFontVariables } from "@/web/theme/fonts";
import "@/web/theme/tokens.css";
import "@/web/gate/shell.css";

// The /app route: an installable, full-screen web app (port of the iOS app). See web/README.md, "Gate + PWA".

export const metadata: Metadata = {
  title: "Sisu",
  description: "A financial coach on S-Pankki's synthetic data.",
  manifest: "/app.webmanifest",
  appleWebApp: { capable: true, title: "Sisu", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/app-icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F8F7",
  colorScheme: "light",
};

export default function SisuAppLayout({ children }: { children: React.ReactNode }) {
  return <div className={`sisu-root ${sisuFontVariables}`}>{children}</div>;
}
