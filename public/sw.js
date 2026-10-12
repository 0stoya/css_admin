/* CSS Commerce PWA foundation — shared by Staff Admin and Company Portal.
 * SECURITY: this worker deliberately has NO fetch handler, offline cache,
 * background sync, or Push API subscription logic. Every authenticated page,
 * GraphQL request, company record, CSV/XLSX and token remains network-only.
 * Identity-bound Web Push is a separate, gated release.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
