// 上传示例模型到 Supabase 存储桶的脚本
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('缺少 Supabase 环境变量');
  process.exit(1);
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 示例模型 URL - 使用 GLB 格式，更适合 Web 使用
const sampleModels = [
  {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
    name: 'duck.glb',
    description: '示例鸭子模型'
  },
  {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb',
    name: 'box.glb',
    description: '示例盒子模型'
  },
  {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF-Binary/Avocado.glb',
    name: 'avocado.glb',
    description: '示例牛油果模型'
  },
  {
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
    name: 'damaged_helmet.glb',
    description: '示例损坏头盔模型'
  }
];

// 下载文件
async function downloadFile(url, outputPath) {
  console.log(`下载文件: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    console.log(`文件已保存到: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`下载文件时出错: ${error.message}`);
    return false;
  }
}

// 上传文件到 Supabase
async function uploadToSupabase(filePath, fileName) {
  console.log(`上传文件到 Supabase: ${fileName}`);

  try {
    const fileBuffer = fs.readFileSync(filePath);

    // 我们假设存储桶已经存在，直接上传文件
    console.log('使用现有的 models 存储桶...');

    // 上传文件
    const { data, error } = await supabase.storage
      .from('models')
      .upload(fileName, fileBuffer, {
        contentType: fileName.endsWith('.glb') ? 'model/gltf-binary' : 'model/gltf+json',
        upsert: true
      });

    if (error) {
      throw new Error(`上传文件失败: ${error.message}`);
    }

    // 获取公共 URL
    const { data: { publicUrl } } = supabase.storage.from('models').getPublicUrl(fileName);

    console.log(`文件已上传: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`上传文件时出错: ${error.message}`);
    return null;
  }
}

// 创建模型记录
async function createModelRecord(name, filePath, description) {
  console.log(`创建模型记录: ${name}`);

  try {
    const { data, error } = await supabase
      .from('models')
      .insert([
        {
          name,
          file_path: filePath,
          description: description || `示例模型: ${name}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      throw new Error(`创建模型记录失败: ${error.message}`);
    }

    console.log(`模型记录已创建: ${data[0].id}`);
    return data[0];
  } catch (error) {
    console.error(`创建模型记录时出错: ${error.message}`);
    return null;
  }
}

// 主函数
async function main() {
  console.log('开始上传示例模型...');

  // 创建临时目录
  const tempDir = path.join(path.resolve(__dirname, '..'), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  for (const model of sampleModels) {
    const filePath = path.join(tempDir, model.name);

    // 下载文件
    const downloaded = await downloadFile(model.url, filePath);
    if (!downloaded) continue;

    // 上传到 Supabase
    const publicUrl = await uploadToSupabase(filePath, model.name);
    if (!publicUrl) continue;

    // 创建模型记录
    await createModelRecord(model.name, publicUrl, model.description);

    // 删除临时文件
    fs.unlinkSync(filePath);
  }

  console.log('示例模型上传完成');
}

main().catch(error => {
  console.error('上传示例模型时出错:', error);
  process.exit(1);
});
