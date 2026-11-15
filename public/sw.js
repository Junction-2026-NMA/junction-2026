// Sisu's service worker: phone notifications only. There is no fetch handler on purpose, so nothing is cached and
// every update of the app shows at once. Registered by web/app/Push.ts at scope "/" (it covers /app, the start_url).
// A push carries { title, body, url, tag } and nothing financial (lib/push/notify.ts). iOS requires every push to
// show a notification, so one is always shown.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Sisu";
  const body = typeof data.body === "string" && data.body ? data.body : "Sisu has an update.";
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/app?source=homescreen";
  const tag = typeof data.tag === "string" && data.tag ? data.tag : "sisu";
  event.waitUntil(self.registration.showNotification(title, { body, tag, renotify: true, data: { url }, icon: "/app-icons/icon-192.png", badge: "/app-icons/icon-192.png" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/app?source=homescreen", self.location.origin);
  const message = { type: "open-project", customerId: url.searchParams.get("customer"), projectId: url.searchParams.get("project") };
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const app = windows.find((client) => new URL(client.url).pathname.startsWith("/app"));
      if (app) {
        app.postMessage(message);
        await app.focus().catch(() => undefined);
        return;
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
