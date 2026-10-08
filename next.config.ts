import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
