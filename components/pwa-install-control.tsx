"use client";

import { Download } from "lucide-react";
import { useEffect, useId, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isAppleMobileDevice() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function installedStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallControl({ surface }: { surface: "staff" | "portal" }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();

  useEffect(() => {
    let active = true;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setHelpOpen(false);
    };
    const display = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setInstalled(installedStandalone());

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    display.addEventListener?.("change", onDisplayChange);

    // Browser detection is client-only and deferred from the effect's setup.
    queueMicrotask(() => {
      if (!active) return;
      setIos(isAppleMobileDevice());
      setInstalled(installedStandalone());
    });

    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      display.removeEventListener?.("change", onDisplayChange);
    };
  }, []);

  if (installed || (!installPrompt && !ios)) return null;

  async function install() {
    if (!installPrompt) {
      setHelpOpen(value => !value);
      return;
    }

    try {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") setInstalled(true);
    } catch {
      // The browser may reject an install request or remove the prompt.
    } finally {
      setInstallPrompt(null);
    }
  }

  const label = surface === "staff" ? "Install CSS Admin" : "Install CSS Portal";
  return (
    <div className="pwa-install-control">
      <button
        className="pwa-install-trigger"
        type="button"
        onClick={() => void install()}
        aria-label={label}
        aria-expanded={ios && !installPrompt ? helpOpen : undefined}
        aria-controls={ios && !installPrompt ? helpId : undefined}
        title={label}
      >
        <Download size={16} aria-hidden="true" />
        <span>Install app</span>
      </button>
      {ios && helpOpen ? (
        <div id={helpId} className="pwa-install-help" role="status">
          <strong>Install on your iPhone or iPad</strong>
          <p>Tap the browser Share icon, choose Add to Home Screen, and then open the installed app.</p>
          <button type="button" onClick={() => setHelpOpen(false)}>Close</button>
        </div>
      ) : null}
    </div>
  );
}
