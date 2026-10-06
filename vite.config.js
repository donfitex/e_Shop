import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  root: "client",
  envDir: "..",
  plugins: [react(), tailwind()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } },
});
