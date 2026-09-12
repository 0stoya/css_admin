import type { ReactNode } from "react";
import { PurchaseControlGuidance } from "@/components/purchase-control-guidance";

export default function PurchaseControlsLayout({ children }: { children: ReactNode }) {
  return <div className="stack">{children}<PurchaseControlGuidance /></div>;
}
