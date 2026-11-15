// Sisu's service worker: phone notifications for Projects only (web/core/Push.ts). No fetch handler and no cache,
// so every page load comes from the network and updates during the demo stay instant.
// The push payload is { title, body, url, tag }; it never holds financial details (those stay in the app).

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
  const body = typeof data.body === "string" && data.body ? data.body : "Your project has an update.";
  const url = typeof data.url === "string" && data.url.startsWith("/app") ? data.url : "/app?source=homescreen";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: typeof data.tag === "string" ? data.tag : undefined,
    data: { url },
    icon: "/app-icons/icon-192.png",
    badge: "/app-icons/icon-192.png",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app?source=homescreen";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const app = windows.find((client) => new URL(client.url).pathname.startsWith("/app"));
    if (app) {
      app.postMessage({ type: "sisu-open", url });
      try {
        await app.focus();
      } catch {
        // Focusing can be refused; the message above still opens the finding.
      }
      return;
    }
    await self.clients.openWindow(url);
  })());
});
