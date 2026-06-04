import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Dev server proxy.
//
// The backend microservices only enable CORS for ports 8000–8003, so a browser
// app served from Vite (5173) cannot call them directly. Instead the frontend
// talks to same-origin "/api/*" paths, and Vite transparently proxies each
// prefix to the correct service. This keeps the browser same-origin (no CORS)
// and means the backend never has to be modified.
// ─────────────────────────────────────────────────────────────────────────────
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendors into their own chunks for faster initial load.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          query: ["@tanstack/react-query", "axios"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/auth": {
        target: "http://localhost:8003",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/auth/, ""),
      },
      "/api/flight": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/flight/, ""),
      },
      "/api/booking": {
        target: "http://localhost:8001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/booking/, ""),
      },
      "/api/baggage": {
        target: "http://localhost:8002",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/baggage/, ""),
      },
    },
  },
});
