import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  // Every service is reached through job-platform-gateway (YARP): run it on :5000
  // (scripts/run-gateway.ps1) or point VITE_GATEWAY_URL at another gateway.
  const gateway = env.VITE_GATEWAY_URL || "http://localhost:5000";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": { target: gateway, changeOrigin: true },
        // SRS WS-01: realtime channel (gateway route not implemented yet).
        "/ws": { target: gateway, changeOrigin: true, ws: true },
      },
    },
  };
});
