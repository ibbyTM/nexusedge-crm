import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export, same as the marketing site. Everything dynamic runs
  // client-side against the PHP API in server/.
  output: "export",
};

export default nextConfig;
