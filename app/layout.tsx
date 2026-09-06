import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./company-structure.css";
import "./company-management.css";

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
