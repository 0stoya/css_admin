"use client";

import { BellRing, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

type PushStatus = {
  enabled: boolean;
  subscribed: boolean;
  publicKey: string | null;
};

function webPushSupported() {
  return typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
}

function publicKeyBytes(key: string) {
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(Math.ceil(key.length / 4) * 4, "="));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export function StaffExportPushControls() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [supported, setSupported] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const isSupported = webPushSupported();
    queueMicrotask(() => {
      if (!active) return;
      setSupported(isSupported);
      setBlocked(isSupported && Notification.permission === "denied");
    });
    if (isSupported) {
      void fetch("/api/admin/push/status", {
        credentials: "same-origin", cache: "no-store",
      }).then(async response => {
        if (!response.ok) return null;
        return await response.json() as PushStatus;
      }).then(result => {
        if (active) setStatus(result);
      }).catch(() => {
        // Push is optional. The in-app Jobs bell remains the fallback.
      });
    }
    return () => { active = false; };
  }, []);

  if (!supported || !status?.enabled || !status.publicKey) return null;

  async function enable() {
    if (busy || blocked || !status?.publicKey) return;
    setBusy(true);
    setMessage(null);
    let created: PushSubscription | null = null;
    try {
      // Browser permission can only be requested from this explicit click.
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setBlocked(permission === "denied");
          setMessage("Browser notifications were not enabled.");
          return;
        }
      }
      if (Notification.permission !== "granted") {
        setBlocked(true);
        setMessage("Allow notifications in your browser's site settings.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/", updateViaCache: "none",
      });
      const ready = await navigator.serviceWorker.ready;
      const existing = await ready.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKeyBytes(status.publicKey),
      });
      if (!existing) created = subscription;
      const response = await fetch("/api/admin/push/subscription", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("Could not register this device.");
      setStatus(prev => prev ? { ...prev, subscribed: true } : prev);
      setMessage("Export alerts enabled on this device.");
    } catch {
      // Unsubscribe only if this click created a new subscription.
      if (created) await created.unsubscribe().catch(() => {});
      setMessage("Could not enable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/push/subscription", {
        method: "DELETE",
        credentials: "same-origin", cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not revoke subscription.");
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      setStatus(prev => prev ? { ...prev, subscribed: false } : prev);
      setMessage("Export alerts disabled on this device.");
    } catch {
      setMessage("Could not disable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="staff-push-controls">
      <button className="button button-secondary button-compact" type="button"
        disabled={busy || blocked}
        onClick={() => void (status.subscribed ? disable() : enable())}
        aria-pressed={status.subscribed}
        title={blocked ? "Enable notifications in your browser's settings" : undefined}>
        {status.subscribed
          ? <BellOff size={16} aria-hidden="true" />
          : <BellRing size={16} aria-hidden="true" />}
        <span>{status.subscribed ? "Disable device alerts" : "Enable device alerts"}</span>
      </button>
      {message ? <span className="staff-push-message" role="status">{message}</span> : null}
      {blocked ? <span className="staff-push-message">Notifications blocked by browser</span> : null}
    </div>
  );
}
