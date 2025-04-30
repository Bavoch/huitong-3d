/**
 * 修复模型数据库脚本
 * 
 * 这个脚本会:
 * 1. 清理数据库中的所有模型记录
 * 2. 从存储桶获取模型信息
 * 3. 为每个模型创建一个简单的缩略图
 * 4. 重新创建不重复的记录
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

// 加载环境变量
dotenv.config();

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建Supabase客户端
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少Supabase环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 确保thumbnails存储桶存在
async function ensureThumbnailsBucketExists() {
  try {
    // 检查存储桶是否存在
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) {
      console.error('获取存储桶列表错误:', bucketsError);
      return false;
    }

    // 检查是否有名为'thumbnails'的存储桶
    const thumbnailsBucket = buckets.find(bucket => bucket.name === 'thumbnails');
    if (!thumbnailsBucket) {
      console.log('没有找到名为"thumbnails"的存储桶，尝试创建...');
      const { data, error } = await supabase.storage.createBucket('thumbnails', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/png', 'image/jpeg']
      });

      if (error) {
        console.error('创建存储桶失败:', error);
        return false;
      } else {
        console.log('成功创建"thumbnails"存储桶:', data);
        return true;
      }
    } else {
      console.log('找到"thumbnails"存储桶:', thumbnailsBucket);
      return true;
    }
  } catch (error) {
    console.error('检查/创建存储桶时出错:', error);
    return false;
  }
}

// 生成简单的缩略图
function generateSimpleThumbnail(modelName) {
  console.log(`正在为模型 ${modelName} 生成简单缩略图...`);
  
  try {
    // 创建一个Canvas
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    
    // 生成一个基于模型名称的随机颜色
    const hash = modelName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const r = (hash % 200) + 55; // 55-255 范围内的红色值
    const g = ((hash * 2) % 200) + 55; // 55-255 范围内的绿色值
    const b = ((hash * 3) % 200) + 55; // 55-255 范围内的蓝色值
    
    // 绘制背景
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, 256, 256);
    
    // 绘制中心的彩色方块
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(64, 64, 128, 128);
    
    // 绘制边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(64, 64, 128, 128);
    
    // 绘制模型名称
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    
    // 截断过长的名称
    let displayName = modelName;
    if (displayName.length > 20) {
      displayName = displayName.substring(0, 17) + '...';
    }
    
    ctx.fillText(displayName, 128, 220);
    
    // 转换为Buffer
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error(`为模型 ${modelName} 生成缩略图时出错:`, error);
    return null;
  }
}

// 上传缩略图到Supabase
async function uploadThumbnail(thumbnailBuffer, modelName) {
  try {
    // 生成唯一的文件名
    const fileName = `${Date.now()}_${modelName.replace(/\.[^/.]+$/, '')}_thumbnail.png`;
    
    // 上传到Supabase
    const { data, error } = await supabase.storage
      .from('thumbnails')
      .upload(fileName, thumbnailBuffer, {
        contentType: 'image/png',
        upsert: false
      });
      
    if (error) {
      console.error('上传缩略图失败:', error);
      return null;
    }
    
    // 获取公共URL
    const { data: { publicUrl } } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(data.path);
      
    return publicUrl;
  } catch (error) {
    console.error('上传缩略图时出错:', error);
    return null;
  }
}

// 从存储桶获取模型
async function getModelsFromStorage() {
  try {
    // 列出存储桶中的文件
    const { data: storageData, error: storageError } = await supabase
      .storage
      .from('models')
      .list();

    if (storageError) {
      console.error('获取存储桶数据错误:', storageError);
      return [];
    }

    if (!storageData || storageData.length === 0) {
      console.log('存储桶中没有找到文件');
      return [];
    }

    console.log('从存储桶获取到的文件:', storageData);

    // 过滤出3D模型文件
    const modelFiles = storageData.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return ['glb', 'gltf', 'obj', 'fbx'].includes(extension || '');
    });

    if (modelFiles.length === 0) {
      console.log('存储桶中没有找到有效的3D模型文件');
      return [];
    }

    // 将存储桶中的文件转换为模型数据格式
    const storageModels = [];
    
    for (const file of modelFiles) {
      // 获取文件的公共URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('models')
        .getPublicUrl(file.name);
      
      // 创建模型对象
      const model = {
        name: file.name,
        description: `存储桶中的模型: ${file.name}`,
        file_path: publicUrl,
        created_at: file.created_at || new Date().toISOString(),
        updated_at: file.updated_at || new Date().toISOString()
      };
      
      storageModels.push(model);
    }

    return storageModels;
  } catch (error) {
    console.error('从存储桶获取模型时出错:', error);
    return [];
  }
}

// 清理数据库中的所有模型记录
async function clearModelsTable() {
  try {
    console.log('正在清理数据库中的所有模型记录...');
    
    const { error } = await supabase
      .from('models')
      .delete()
      .neq('id', 0); // 删除所有记录
      
    if (error) {
      console.error('清理数据库记录失败:', error);
      return false;
    }
    
    console.log('成功清理数据库中的所有模型记录');
    return true;
  } catch (error) {
    console.error('清理数据库记录时出错:', error);
    return false;
  }
}

// 主函数
async function main() {
  try {
    console.log('开始修复模型数据库...');
    
    // 确保thumbnails存储桶存在
    const bucketExists = await ensureThumbnailsBucketExists();
    if (!bucketExists) {
      console.error('无法确保thumbnails存储桶存在，终止操作');
      process.exit(1);
    }
    
    // 清理数据库中的所有模型记录
    const cleared = await clearModelsTable();
    if (!cleared) {
      console.error('清理数据库记录失败，终止操作');
      process.exit(1);
    }
    
    // 从存储桶获取模型
    const models = await getModelsFromStorage();
    if (models.length === 0) {
      console.log('没有找到模型，操作完成');
      process.exit(0);
    }
    
    console.log(`找到 ${models.length} 个模型，开始处理...`);
    
    // 为每个模型生成缩略图并创建数据库记录
    for (const model of models) {
      console.log(`处理模型: ${model.name}`);
      
      // 生成缩略图
      const thumbnailBuffer = generateSimpleThumbnail(model.name);
      
      // 如果成功生成缩略图，上传到Supabase
      let thumbnailUrl = null;
      if (thumbnailBuffer) {
        thumbnailUrl = await uploadThumbnail(thumbnailBuffer, model.name);
        if (thumbnailUrl) {
          console.log(`成功为模型 ${model.name} 生成并上传缩略图: ${thumbnailUrl}`);
        } else {
          console.warn(`为模型 ${model.name} 上传缩略图失败`);
        }
      } else {
        console.warn(`为模型 ${model.name} 生成缩略图失败`);
      }
      
      // 创建数据库记录
      const { error: insertError } = await supabase
        .from('models')
        .insert([{
          name: model.name,
          description: model.description,
          file_path: model.file_path,
          thumbnail_url: thumbnailUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
        
      if (insertError) {
        console.error(`保存模型 ${model.name} 到表中出错:`, insertError);
      } else {
        console.log(`已将模型 ${model.name} 保存到models表`);
      }
    }
    
    console.log('模型数据库修复完成');
  } catch (error) {
    console.error('修复模型数据库时出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main();
