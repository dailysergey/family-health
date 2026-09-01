// Service Worker — Health Dashboard Push Notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: "Здоровье семьи", body: event.data.text() }; }

  const options = {
    body: data.body ?? "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag ?? "health-default",
    renotify: !!data.renotify,
    data: { url: data.url ?? "/" },
    actions: data.actions ?? [],
    requireInteraction: data.requireInteraction ?? false,
    silent: data.silent ?? false,
  };

  event.waitUntil(self.registration.showNotification(data.title ?? "Здоровье семьи", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
