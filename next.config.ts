import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Service-Worker-Allowed", value: "/" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
  experimental: {
    serverActions: {
      // Bulk-import CSVs are capped at 10 MiB in the Server Action itself.
      // Keep transport headroom for multipart/form-data framing and the
      // subsequent Apply/Retry post that resubmits the reviewed CSV source.
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
