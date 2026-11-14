import { headers } from "next/headers";
import { userAgent } from "next/server";
import DeviceGate from "@/web/gate/DeviceGate";
import AppLoader from "@/web/gate/AppLoader";
import { kindFromUserAgent, parseOverrides, platformFromUserAgent } from "@/web/gate/detect";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * /app. First pass on the server from the user-agent header (no flash of the wrong screen),
 * then DeviceGate confirms in the browser. Overrides: ?device=phone|desktop, ?standalone=1.
 */
export default async function AppPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const ua = userAgent({ headers: await headers() });
  const overrides = parseOverrides(query);
  const fromHomeScreen = query.source === "homescreen";

  return (
    <DeviceGate
      initialKind={kindFromUserAgent(ua.ua, ua.device.type)}
      initialStandalone={fromHomeScreen}
      initialPlatform={platformFromUserAgent(ua.ua)}
      overrides={overrides}
    >
      <AppLoader />
    </DeviceGate>
  );
}
