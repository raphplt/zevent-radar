/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//, /^\/data\//] }));

registerRoute(
  ({ url }) => url.pathname.startsWith("/data/") || url.hostname.startsWith("data."),
  new NetworkFirst({ cacheName: "zr-data", networkTimeoutSeconds: 8, plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 24 * 3600 })] })
);

registerRoute(
  ({ url }) => url.hostname === "static-cdn.jtvnw.net",
  new CacheFirst({ cacheName: "zr-avatars", plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 7 * 24 * 3600 })] })
);

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  type?: string;
}

self.addEventListener("push", (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    payload = { body: event.data?.text() ?? "" };
  }
  const title = payload.title ?? "ZEvent Radar";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      tag: payload.tag,
      data: { url: payload.url ?? "/" },
      requireInteraction: payload.type === "approaching"
    } as NotificationOptions)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data as { url?: string })?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          void client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
