import type { ReactNode } from "react";

export default function PurchaseControlsLayout({ children }: { children: ReactNode }) {
  return <div className="stack">{children}</div>;
}
