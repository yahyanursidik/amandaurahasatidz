import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@netlify": path.resolve(__dirname, "./netlify"),
    },
  },
  server: {
    port: 3000,
  },
});
