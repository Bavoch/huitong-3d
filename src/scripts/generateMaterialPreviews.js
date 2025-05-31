import fs from 'fs';
import { createCanvas } from 'canvas';

// 创建材质球预览图像的目录
const outputDir = './public/materials';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 预设材质定义
const materials = [
  { name: '金属', color: '#D4D4D4', roughness: 0.1, metallic: 1.0 },
  { name: '金', color: '#FFD700', roughness: 0.1, metallic: 1.0 },
  { name: '银', color: '#C0C0C0', roughness: 0.1, metallic: 1.0 },
  { name: '铜', color: '#B87333', roughness: 0.2, metallic: 1.0 },
  { name: '铬', color: '#E8E8E8', roughness: 0.05, metallic: 1.0 },
  { name: '塑料红', color: '#FF5252', roughness: 0.7, metallic: 0.0 },
  { name: '塑料蓝', color: '#4285F4', roughness: 0.7, metallic: 0.0 },
  { name: '塑料绿', color: '#0F9D58', roughness: 0.7, metallic: 0.0 },
  { name: '塑料黄', color: '#FFEB3B', roughness: 0.7, metallic: 0.0 },
  { name: '塑料黑', color: '#212121', roughness: 0.7, metallic: 0.0 },
  { name: '塑料白', color: '#FFFFFF', roughness: 0.7, metallic: 0.0 },
  { name: '玻璃', color: '#E0F7FA', roughness: 0.0, metallic: 0.0 },
  { name: '橡胶', color: '#424242', roughness: 1.0, metallic: 0.0 },
  { name: '木材', color: '#8D6E63', roughness: 0.9, metallic: 0.0 },
  { name: '大理石', color: '#E0E0E0', roughness: 0.3, metallic: 0.0 },
  { name: '陶瓷', color: '#F5F5F5', roughness: 0.5, metallic: 0.0 },
  { name: '皮革', color: '#795548', roughness: 0.8, metallic: 0.0 },
  { name: '布料', color: '#9E9E9E', roughness: 1.0, metallic: 0.0 },
  { name: '霓虹红', color: '#FF1744', roughness: 0.3, metallic: 0.5 },
  { name: '霓虹蓝', color: '#2979FF', roughness: 0.3, metallic: 0.5 },
  { name: '霓虹绿', color: '#00E676', roughness: 0.3, metallic: 0.5 },
  { name: '霓虹紫', color: '#D500F9', roughness: 0.3, metallic: 0.5 },
  { name: '珍珠', color: '#F5F5F5', roughness: 0.2, metallic: 0.8 },
  { name: '锈金属', color: '#8D6E63', roughness: 0.7, metallic: 0.8 },
];

// 创建材质球预览图像
function createMaterialPreview(material, index) {
  const size = 200; // 画布大小
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 设置背景
  ctx.fillStyle = '#262626';
  ctx.fillRect(0, 0, size, size);
  
  // 解析颜色
  const r = parseInt(material.color.slice(1, 3), 16);
  const g = parseInt(material.color.slice(3, 5), 16);
  const b = parseInt(material.color.slice(5, 7), 16);
  
  // 创建径向渐变来模拟材质球
  const gradient = ctx.createRadialGradient(
    size * 0.4, size * 0.4, size * 0.1, 
    size * 0.5, size * 0.5, size * 0.7
  );
  
  // 根据材质属性调整光照
  const highlightIntensity = 1 - material.roughness;
  const metallicFactor = material.metallic;
  
  // 主光源颜色
  const mainLight = `rgb(${Math.min(255, r + 100)}, ${Math.min(255, g + 100)}, ${Math.min(255, b + 100)})`;
  
  // 金属材质有色彩反射，非金属材质高光是白色的
  const highlightColor = metallicFactor > 0.5 
    ? `rgba(${r + (255 - r) * 0.7}, ${g + (255 - g) * 0.7}, ${b + (255 - b) * 0.7}, ${highlightIntensity})`
    : `rgba(255, 255, 255, ${highlightIntensity})`;
  
  // 环境光影响
  const ambientColor = `rgb(${r * 0.8}, ${g * 0.8}, ${b * 0.8})`;
  
  // 设置渐变颜色
  gradient.addColorStop(0, highlightColor);
  gradient.addColorStop(0.2, mainLight);
  gradient.addColorStop(0.5, material.color);
  gradient.addColorStop(1, ambientColor);
  
  // 绘制材质球
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  
  // 添加环境反射（如果是金属或光滑表面）
  if (material.roughness < 0.5 || material.metallic > 0.5) {
    const reflectionOpacity = (1 - material.roughness) * 0.5 + material.metallic * 0.3;
    ctx.fillStyle = `rgba(255, 255, 255, ${reflectionOpacity})`;
    ctx.beginPath();
    ctx.ellipse(size * 0.35, size * 0.35, size * 0.1, size * 0.05, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // 添加边框
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  
  // 将画布内容保存为PNG文件
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`${outputDir}/material-${index}.png`, buffer);
  
  console.log(`已生成材质: ${material.name}`);
}

// 生成所有材质预览
materials.forEach((material, index) => {
  createMaterialPreview(material, index);
});

console.log(`已生成 ${materials.length} 个材质预览图像到 ${outputDir} 目录`);

// 创建材质数据文件，以便在应用中使用
const materialsData = materials.map((material, index) => ({
  id: index,
  name: material.name,
  color: material.color,
  roughness: material.roughness,
  metallic: material.metallic,
  imagePath: `/materials/material-${index}.png`
}));

fs.writeFileSync('./public/materials/materials.json', JSON.stringify(materialsData, null, 2));
console.log('已生成材质数据文件: materials.json');
