/**
 * 重建模型数据库脚本
 * 
 * 这个脚本会:
 * 1. 清理数据库中的所有模型记录
 * 2. 从存储桶获取模型信息
 * 3. 为每个模型生成缩略图
 * 4. 重新创建不重复的记录
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

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

// 使用Puppeteer生成模型缩略图
async function generateThumbnail(modelUrl, modelName) {
  console.log(`正在为模型 ${modelName} 生成缩略图...`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 设置视口大小
    await page.setViewport({ width: 256, height: 256 });
    
    // 创建一个简单的HTML页面来渲染模型
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Model Thumbnail Generator</title>
          <style>
            body { margin: 0; overflow: hidden; background-color: transparent; }
            canvas { width: 100%; height: 100%; }
          </style>
          <script async src="https://unpkg.com/es-module-shims@1.6.3/dist/es-module-shims.js"></script>
          <script type="importmap">
            {
              "imports": {
                "three": "https://unpkg.com/three@0.150.1/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@0.150.1/examples/jsm/"
              }
            }
          </script>
          <script type="module">
            import * as THREE from 'three';
            import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
            import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
            
            // 创建场景
            const scene = new THREE.Scene();
            
            // 创建相机
            const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
            camera.position.set(0, 0, 5);
            
            // 创建渲染器
            const renderer = new THREE.WebGLRenderer({ 
              antialias: true,
              alpha: true,
              preserveDrawingBuffer: true
            });
            renderer.setSize(256, 256);
            renderer.setClearColor(0x000000, 0);
            document.body.appendChild(renderer.domElement);
            
            // 添加光源
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(1, 1, 1);
            scene.add(directionalLight);
            
            // 加载模型
            const loader = new GLTFLoader();
            loader.load(
              '${modelUrl}',
              (gltf) => {
                const model = gltf.scene;
                
                // 计算包围盒并居中模型
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                
                // 重置模型位置到中心
                model.position.x = -center.x;
                model.position.y = -center.y;
                model.position.z = -center.z;
                
                // 调整相机位置以适应模型大小
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = camera.fov * (Math.PI / 180);
                let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                
                // 添加一些边距
                cameraZ *= 1.5;
                
                // 更新相机位置
                camera.position.z = cameraZ;
                
                // 确保相机看向模型中心
                camera.lookAt(new THREE.Vector3(0, 0, 0));
                camera.updateProjectionMatrix();
                
                // 添加模型到场景
                scene.add(model);
                
                // 渲染场景
                renderer.render(scene, camera);
                
                // 通知页面已准备好截图
                window.thumbnailReady = true;
              },
              undefined,
              (error) => {
                console.error('加载模型时出错:', error);
                // 创建一个简单的彩色方块作为缩略图
                const geometry = new THREE.BoxGeometry(1, 1, 1);
                const material = new THREE.MeshStandardMaterial({ 
                  color: 0x2268eb,
                  roughness: 0.5,
                  metalness: 0.5
                });
                const cube = new THREE.Mesh(geometry, material);
                scene.add(cube);
                
                // 渲染场景
                renderer.render(scene, camera);
                
                // 通知页面已准备好截图
                window.thumbnailReady = true;
              }
            );
          </script>
        </head>
        <body>
        </body>
      </html>
    `;
    
    // 设置页面内容
    await page.setContent(htmlContent);
    
    // 等待模型加载和渲染完成
    await page.waitForFunction('window.thumbnailReady === true', { timeout: 30000 }).catch(() => {
      console.warn(`等待模型 ${modelName} 加载超时，将使用默认缩略图`);
    });
    
    // 额外等待一点时间确保渲染完成
    await page.waitForTimeout(1000);
    
    // 截取屏幕截图
    const screenshot = await page.screenshot({ 
      type: 'png',
      omitBackground: true
    });
    
    return screenshot;
  } catch (error) {
    console.error(`为模型 ${modelName} 生成缩略图时出错:`, error);
    return null;
  } finally {
    await browser.close();
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
    console.log('开始重建模型数据库...');
    
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
      const thumbnailBuffer = await generateThumbnail(model.file_path, model.name);
      
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
    
    console.log('模型数据库重建完成');
  } catch (error) {
    console.error('重建模型数据库时出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main();
