import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Auth direct :5001 until job-platform-gateway has a real YARP + Dockerfile.
      // When gateway is up: change target to http://localhost:5000
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  };
});
