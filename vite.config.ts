import react from "@vitejs/plugin-react";
import tailwind from "tailwindcss";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  css: {
    postcss: {
      plugins: [tailwind()],
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true // 如果端口被占用，不自动尝试下一个端口，而是直接报错
  },
});
