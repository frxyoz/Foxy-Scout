import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  optimizeDeps: { entries: ["index.html"], include: ["react", "react-dom/client", "@tauri-apps/api/core"] },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**", "**/backups/**", "**/.cache/**", "**/dist/**", "**/.venv/**", "**/build/**", "**/frontend-dist/**", "**/*.app/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "es2022", outDir: "frontend-dist" },
});
