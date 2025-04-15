# 会通3D项目

## 项目简介

会通3D是一个基于Web的3D模型展示和材质定制平台，允许用户上传、查看和自定义3D模型的材质。该项目旨在为家具、装饰和建筑行业提供直观的3D可视化解决方案。

## 功能特点

- **3D模型展示**：使用Three.js渲染高质量3D模型
- **材质定制**：提供多种材质选项，实时预览效果
- **模型上传**：支持用户上传自己的3D模型
- **云存储集成**：使用Supabase进行模型和材质的存储管理
- **响应式设计**：适配各种设备尺寸的界面

## 技术栈

- **前端框架**：React + TypeScript
- **3D渲染**：Three.js
- **样式**：Tailwind CSS
- **构建工具**：Vite
- **后端服务**：Supabase (数据库、存储和云函数)

## 开始使用

### 环境要求

- Node.js 16.x 或更高版本
- npm 7.x 或更高版本

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/Bavoch/huitong-3d.git
cd huitong-3d
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
创建一个`.env`文件，参考`.env.example`添加必要的环境变量

4. 启动开发服务器
```bash
npm run dev
```

应用将在 [http://localhost:5173/](http://localhost:5173/) 上运行

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
/src
  /components      # UI组件
  /screens         # 页面组件
  /lib             # 工具函数和API封装
  /types           # TypeScript类型定义
/public            # 静态资源
  /materials       # 材质资源
/supabase          # Supabase配置和云函数
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m '添加新功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

本项目采用 MIT 许可证
