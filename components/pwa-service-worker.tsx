"use client";

import { useEffect } from "react";

// Register only inside an authenticated Staff/Portal layout. Do not install
// an offline cache: this app handles confidential company and customer data.
export function PwaServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch(() => {
      // PWA capability is optional and must never break Staff/Portal sign-in.
    });
  }, []);

  return null;
}
