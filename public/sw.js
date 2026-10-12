/* CSS Commerce PWA foundation — shared by Staff Admin and Company Portal.
 * SECURITY: this worker deliberately has NO fetch handler, offline cache,
 * background sync, or request interception. Every authenticated page,
 * GraphQL request, company record, CSV/XLSX and token remains network-only.
 * Staff export Web Push is optional, user-bound and carries no private data.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { return; }
  if (payload?.event !== "export_ready") return;
  event.waitUntil(self.registration.showNotification("CSS Admin", {
    body: "Your export is ready. Open Jobs to download.",
    icon: "/pwa/icon/192",
    tag: "css-admin-export-ready",
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/jobs"));
});
