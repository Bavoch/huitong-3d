import react from "@vitejs/plugin-react";
import tailwind from "tailwindcss";
import { defineConfig } from "vite";
import dns from 'dns';
import { resolve } from 'path';

// 确保IPv4优先
dns.setDefaultResultOrder('verbatim');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 使用相对路径，确保在不同预览环境中资源路径正确
  base: './',
  css: {
    postcss: {
      plugins: [tailwind()],
    },
  },
  server: {
    host: "localhost",
    port: 3000, // 固定使用3000端口
    strictPort: true, // 如果端口被占用，报错而不是尝试其他端口
    hmr: {
      overlay: true, // 在页面上显示错误
      port: 3000,
      host: "localhost",
    },
    watch: {
      usePolling: false, // 关闭轮询，提高性能
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
    open: false, // 不自动打开浏览器
    fs: {
      strict: false,
      allow: ['.'],
    },
  },
  // 配置静态资源
  publicDir: 'public',
  // 构建配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
    // 改进兼容性设置
    target: 'es2015', // 更好的浏览器兼容性
    minify: 'terser',
  },
  // 优化预览环境
  preview: {
    port: 3000,
    strictPort: false,
    host: true,
    open: false,
  },
});
