import react from "@vitejs/plugin-react";
import tailwind from "tailwindcss";
import { defineConfig } from "vite";
import dns from 'dns';

// 确保IPv4优先
dns.setDefaultResultOrder('verbatim');

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
    port: 3000, // 使用3000端口
    strictPort: false, // 如果端口被占用，尝试下一个可用端口
    hmr: {
      // 启用热模块替换
      overlay: true, // 在页面上显示错误
    },
    watch: {
      // 监视文件变化
      usePolling: false, // 使用文件系统事件而不是轮询
      ignored: ['**/node_modules/**', '**/dist/**'], // 忽略这些目录的变化
    },
    open: false, // 不自动打开浏览器
  },
});
