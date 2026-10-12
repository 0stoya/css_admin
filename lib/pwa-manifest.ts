// Public install metadata only. Neither manifest contains identity, credentials,
// company information or session-derived content.
export type PwaSurface = "staff" | "portal";

export const PWA_ICON_SIZES = [180, 192, 512] as const;

export function pwaManifest(surface: PwaSurface) {
  const staff = surface === "staff";
  return {
    id: staff ? "/pwa/css-staff-admin" : "/pwa/css-company-portal",
    name: staff ? "Chelmsford Safety — Staff Admin" : "Chelmsford Safety — Company Portal",
    short_name: staff ? "CSS Admin" : "CSS Portal",
    description: staff
      ? "Secure Chelmsford Safety Supplies staff operations."
      : "Secure Chelmsford Safety Supplies company account management.",
    start_url: staff ? "/companies" : "/portal",
    scope: "/",
    display: "standalone" as const,
    background_color: "#f4f4f4",
    theme_color: "#0057a8",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon/512", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
