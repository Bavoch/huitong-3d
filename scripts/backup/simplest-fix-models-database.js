/**
 * 最简单的修复模型数据库脚本
 * 
 * 这个脚本会:
 * 1. 删除重复的模型记录，只保留每个文件路径的最新记录
 * 2. 为每个模型创建一个简单的缩略图URL（使用占位图像服务）
 * 3. 更新数据库记录
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

// 删除重复的模型记录，只保留每个文件路径的最新记录
async function removeDuplicateRecords() {
  try {
    console.log('正在删除重复的模型记录...');
    
    // 使用SQL查询删除重复记录
    const { error } = await supabase.query(`
      -- 创建一个临时表来存储每个file_path的最新记录的ID
      CREATE TEMP TABLE latest_models AS
      SELECT DISTINCT ON (file_path) id
      FROM models
      ORDER BY file_path, created_at DESC;
      
      -- 删除不在临时表中的记录
      DELETE FROM models
      WHERE id NOT IN (SELECT id FROM latest_models);
      
      -- 删除临时表
      DROP TABLE latest_models;
    `);
    
    if (error) {
      console.error('删除重复记录失败:', error);
      return false;
    }
    
    console.log('成功删除重复的模型记录');
    return true;
  } catch (error) {
    console.error('删除重复记录时出错:', error);
    return false;
  }
}

// 为所有模型更新缩略图URL
async function updateThumbnailUrls() {
  try {
    console.log('正在为所有模型更新缩略图URL...');
    
    // 获取所有模型记录
    const { data: models, error } = await supabase
      .from('models')
      .select('*');
      
    if (error) {
      console.error('获取模型记录失败:', error);
      return false;
    }
    
    console.log(`找到 ${models.length} 个模型记录，开始更新缩略图URL...`);
    
    // 为每个模型更新缩略图URL
    for (const model of models) {
      // 如果已经有缩略图，跳过
      if (model.thumbnail_url) {
        console.log(`模型 ${model.name} 已有缩略图，跳过`);
        continue;
      }
      
      console.log(`处理模型: ${model.name}`);
      
      // 生成一个基于模型名称的随机颜色
      const hash = model.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const r = (hash % 200) + 55; // 55-255 范围内的红色值
      const g = ((hash * 2) % 200) + 55; // 55-255 范围内的绿色值
      const b = ((hash * 3) % 200) + 55; // 55-255 范围内的蓝色值
      const color = `${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      
      // 使用占位图像服务生成缩略图URL
      // 这里使用placehold.co服务，它可以生成带有文本的彩色占位图像
      const thumbnailUrl = `https://placehold.co/256x256/${color}/FFFFFF?text=${encodeURIComponent(model.name.substring(0, 10))}`;
      
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
    }
    
    console.log('所有模型的缩略图URL更新完成');
    return true;
  } catch (error) {
    console.error('为所有模型更新缩略图URL时出错:', error);
    return false;
  }
}

// 主函数
async function main() {
  try {
    console.log('开始最简单的修复模型数据库...');
    
    // 删除重复的模型记录
    const deduped = await removeDuplicateRecords();
    if (!deduped) {
      console.error('删除重复记录失败，终止操作');
      process.exit(1);
    }
    
    // 为所有模型更新缩略图URL
    const thumbnailsUpdated = await updateThumbnailUrls();
    if (!thumbnailsUpdated) {
      console.error('为所有模型更新缩略图URL失败，终止操作');
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
