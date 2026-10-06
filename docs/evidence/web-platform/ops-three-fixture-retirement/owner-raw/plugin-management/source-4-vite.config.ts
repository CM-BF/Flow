import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "assistant-ui",
              test: /@assistant-ui|@radix-ui|assistant-stream/,
            },
          ],
        },
      },
    },
  },
  server: {
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.FLOW_CENTER_URL ?? "http://127.0.0.1:4317",
        changeOrigin: true,
      },
    },
  },
});
