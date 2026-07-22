self.addEventListener("push", function (event) {
  var data = { title: "CrickPulse", body: "A live match update is available.", url: "/en" };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/brand/crickpulse-logo.png", badge: "/brand/crickpulse-logo.png", data: { url: data.url }, tag: data.tag || "crickpulse-update", renotify: true }));
});
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow((event.notification.data && event.notification.data.url) || "/en"));
});
