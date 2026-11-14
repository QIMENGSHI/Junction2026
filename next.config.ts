import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB is a native module: load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  // The routes read db/kori.duckdb at runtime; make sure deployments ship the file with them.
  outputFileTracingIncludes: {
    "/": ["./db/kori.duckdb"],
    "/api/**": ["./db/kori.duckdb"],
    "/dev": ["./db/kori.duckdb"],
  },
};

export default nextConfig;
