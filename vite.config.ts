import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    // Split vendor libraries into separate chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — changes rarely, cached indefinitely by browsers
          "vendor-react": ["react", "react-dom"],
          // Router
          "vendor-router": ["wouter"],
          // Data fetching
          "vendor-query": ["@tanstack/react-query"],
          // UI component library (large — separate chunk for caching)
          "vendor-radix": [
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
          ],
          // Map library (large, only needed on public pages)
          "vendor-maps": ["leaflet", "react-leaflet"],
        },
      },
    },
    // Warn only on chunks > 1MB (individual vendor chunks will be much smaller)
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
