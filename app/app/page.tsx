import { headers } from "next/headers";
import { userAgent } from "next/server";
import DeviceGate from "@/web/gate/DeviceGate";
import AppLoader from "@/web/gate/AppLoader";
import { kindFromUserAgent, parseOverrides, platformFromUserAgent } from "@/web/gate/detect";
import { publicDemoUrl, qrSvg } from "@/web/gate/qrServer";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * /app. First pass on the server from the user-agent header (no flash of the wrong screen),
 * then DeviceGate confirms in the browser. Overrides: ?device=phone|desktop, ?standalone=1.
 * The desktop QR code is drawn here, into the HTML, so it never depends on a script loading.
 */
export default async function AppPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const head = await headers();
  const ua = userAgent({ headers: head });
  const overrides = parseOverrides(query);
  const fromHomeScreen = query.source === "homescreen";
  const qrUrl = publicDemoUrl(head.get("x-forwarded-host") ?? head.get("host"), head.get("x-forwarded-proto"));

  return (
    <DeviceGate
      initialKind={kindFromUserAgent(ua.ua, ua.device.type)}
      initialStandalone={fromHomeScreen}
      initialPlatform={platformFromUserAgent(ua.ua)}
      overrides={overrides}
      qr={{ url: qrUrl, svg: await qrSvg(qrUrl) }}
    >
      <AppLoader />
    </DeviceGate>
  );
}
