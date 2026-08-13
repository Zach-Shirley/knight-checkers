import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["127.0.0.1.sslip.io", "knight-checkers.127.0.0.1.sslip.io"]
  },
  preview: {
    allowedHosts: ["127.0.0.1.sslip.io", "knight-checkers.127.0.0.1.sslip.io"]
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
