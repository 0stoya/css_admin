import { pwaManifest } from "@/lib/pwa-manifest";

export function GET() {
  return Response.json(pwaManifest("staff"), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
