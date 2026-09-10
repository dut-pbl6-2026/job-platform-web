import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** Local YARP gateway (job-platform-gateway). Override with VITE_GATEWAY_URL. */
const DEFAULT_GATEWAY = "http://localhost:5000";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gatewayUrl = (env.VITE_GATEWAY_URL || DEFAULT_GATEWAY).replace(/\/$/, "");

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Browser calls /api/* → Vite → Gateway :5000 → auth/job/search/...
        "/api": {
          target: gatewayUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
