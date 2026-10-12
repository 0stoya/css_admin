"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AdminJobsAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [active, router]);
  return null;
}
