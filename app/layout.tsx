import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./company-structure.css";
import "./company-management.css";
import "./users-roles-polish.css";
import "./sidebar.css";
import "./control-surfaces.css";
import "./company-overview.css";
import "./catalogue-workspace.css";
import "./catalogue-workspace-polish.css";
import "./purchase-controls.css";

export const metadata: Metadata = {
  title: {
    default: "CSS Commerce",
    template: "%s | CSS Commerce",
  },
  description: "CSS Commerce management application",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
