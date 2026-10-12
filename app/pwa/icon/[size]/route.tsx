import { ImageResponse } from "next/og";

const sizes = new Set(["180", "192", "512"]);

// Public, brand-only PNGs. The icon never depends on session or company data.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: requested } = await params;
  if (!sizes.has(requested)) {
    return new Response("Unknown icon size.", { status: 404 });
  }
  const size = Number(requested);

  return new ImageResponse(
    <div style={{
      width: "100%",
      height: "100%",
      background: "#0057a8",
      color: "#ffffff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      borderRadius: Math.round(size * 0.13),
      fontFamily: "sans-serif",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.29),
        fontWeight: 900,
        letterSpacing: "-0.055em",
      }}>CSS</div>
      <div style={{
        width: Math.round(size * 0.42),
        height: Math.max(6, Math.round(size * 0.039)),
        background: "#ffdd00",
        borderRadius: Math.max(3, Math.round(size * 0.015)),
        marginTop: Math.round(size * 0.045),
      }} />
    </div>,
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=604800",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
