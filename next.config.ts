import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Strip all console.* calls in production builds (except console.error)
    // This removes sensitive data from the browser DevTools console
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error"] }
        : false,
  },
};

export default nextConfig;
