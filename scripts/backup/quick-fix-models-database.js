/**
 * 快速修复模型数据库脚本
 * 
 * 这个脚本会:
 * 1. 删除重复的模型记录，只保留每个文件路径的最新记录
 * 2. 为每个模型创建一个简单的缩略图
 * 3. 更新数据库记录
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createCanvas } from 'canvas';

// 加载环境变量
dotenv.config();

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

// 删除重复的模型记录，只保留每个文件路径的最新记录
async function removeDuplicateRecords() {
  try {
    console.log('正在删除重复的模型记录...');
    
    // 使用SQL查询删除重复记录，只保留每个file_path的最新记录
    const { error } = await supabase.rpc('remove_duplicate_models');
    
    if (error) {
      console.error('删除重复记录失败:', error);
      
      // 如果RPC函数不存在，尝试创建它
      console.log('尝试创建RPC函数...');
      
      // 创建一个SQL函数来删除重复记录
      const { error: createFunctionError } = await supabase.query(`
        CREATE OR REPLACE FUNCTION remove_duplicate_models()
        RETURNS void AS $$
        BEGIN
          -- 创建一个临时表来存储每个file_path的最新记录
          CREATE TEMP TABLE latest_models AS
          SELECT DISTINCT ON (file_path) id
          FROM models
          ORDER BY file_path, created_at DESC;
          
          -- 删除不在临时表中的记录
          DELETE FROM models
          WHERE id NOT IN (SELECT id FROM latest_models);
          
          -- 删除临时表
          DROP TABLE latest_models;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      if (createFunctionError) {
        console.error('创建RPC函数失败:', createFunctionError);
        
        // 如果创建函数失败，使用更简单的方法：获取所有记录，在内存中处理，然后重新创建
        console.log('使用备用方法删除重复记录...');
        
        // 获取所有模型记录
        const { data: allModels, error: fetchError } = await supabase
          .from('models')
          .select('*');
          
        if (fetchError) {
          console.error('获取模型记录失败:', fetchError);
          return false;
        }
        
        // 按file_path分组，只保留每组中最新的记录
        const uniqueModels = {};
        allModels.forEach(model => {
          if (!uniqueModels[model.file_path] || 
              new Date(model.created_at) > new Date(uniqueModels[model.file_path].created_at)) {
            uniqueModels[model.file_path] = model;
          }
        });
        
        // 清空表
        const { error: clearError } = await supabase
          .from('models')
          .delete()
          .neq('id', 0);
          
        if (clearError) {
          console.error('清空表失败:', clearError);
          return false;
        }
        
        // 重新插入唯一记录
        const uniqueModelsArray = Object.values(uniqueModels);
        
        // 分批插入，每次最多插入100条记录
        const batchSize = 100;
        for (let i = 0; i < uniqueModelsArray.length; i += batchSize) {
          const batch = uniqueModelsArray.slice(i, i + batchSize);
          
          // 移除id字段，让数据库自动生成新的id
          const batchWithoutId = batch.map(({ id, ...rest }) => rest);
          
          const { error: insertError } = await supabase
            .from('models')
            .insert(batchWithoutId);
            
          if (insertError) {
            console.error(`插入批次 ${i / batchSize + 1} 失败:`, insertError);
            return false;
          }
        }
        
        console.log(`成功重新插入 ${uniqueModelsArray.length} 条唯一记录`);
        return true;
      }
      
      // 如果成功创建了函数，再次尝试调用它
      const { error: retryError } = await supabase.rpc('remove_duplicate_models');
      
      if (retryError) {
        console.error('再次尝试删除重复记录失败:', retryError);
        return false;
      }
    }
    
    console.log('成功删除重复的模型记录');
    return true;
  } catch (error) {
    console.error('删除重复记录时出错:', error);
    return false;
  }
}

// 为所有模型生成缩略图
async function generateThumbnailsForAllModels() {
  try {
    console.log('正在为所有模型生成缩略图...');
    
    // 获取所有模型记录
    const { data: models, error } = await supabase
      .from('models')
      .select('*');
      
    if (error) {
      console.error('获取模型记录失败:', error);
      return false;
    }
    
    console.log(`找到 ${models.length} 个模型记录，开始生成缩略图...`);
    
    // 为每个模型生成缩略图
    for (const model of models) {
      // 如果已经有缩略图，跳过
      if (model.thumbnail_url) {
        console.log(`模型 ${model.name} 已有缩略图，跳过`);
        continue;
      }
      
      console.log(`处理模型: ${model.name}`);
      
      // 生成缩略图
      const thumbnailBuffer = generateSimpleThumbnail(model.name);
      
      // 如果成功生成缩略图，上传到Supabase
      if (thumbnailBuffer) {
        const thumbnailUrl = await uploadThumbnail(thumbnailBuffer, model.name);
        
        if (thumbnailUrl) {
          console.log(`成功为模型 ${model.name} 生成并上传缩略图: ${thumbnailUrl}`);
          
          // 更新数据库记录
          const { error: updateError } = await supabase
            .from('models')
            .update({ thumbnail_url: thumbnailUrl })
            .eq('id', model.id);
            
          if (updateError) {
            console.error(`更新模型 ${model.name} 的缩略图URL失败:`, updateError);
          } else {
            console.log(`已更新模型 ${model.name} 的缩略图URL`);
          }
        } else {
          console.warn(`为模型 ${model.name} 上传缩略图失败`);
        }
      } else {
        console.warn(`为模型 ${model.name} 生成缩略图失败`);
      }
    }
    
    console.log('所有模型的缩略图生成完成');
    return true;
  } catch (error) {
    console.error('为所有模型生成缩略图时出错:', error);
    return false;
  }
}

// 主函数
async function main() {
  try {
    console.log('开始快速修复模型数据库...');
    
    // 确保thumbnails存储桶存在
    const bucketExists = await ensureThumbnailsBucketExists();
    if (!bucketExists) {
      console.error('无法确保thumbnails存储桶存在，终止操作');
      process.exit(1);
    }
    
    // 删除重复的模型记录
    const deduped = await removeDuplicateRecords();
    if (!deduped) {
      console.error('删除重复记录失败，终止操作');
      process.exit(1);
    }
    
    // 为所有模型生成缩略图
    const thumbnailsGenerated = await generateThumbnailsForAllModels();
    if (!thumbnailsGenerated) {
      console.error('为所有模型生成缩略图失败，终止操作');
      process.exit(1);
    }
    
    console.log('模型数据库修复完成');
  } catch (error) {
    console.error('修复模型数据库时出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main();
