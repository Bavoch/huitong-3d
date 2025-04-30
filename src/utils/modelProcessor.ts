/**
 * 模型处理工具函数
 * 用于处理模型上传前的预处理，包括压缩和优化
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { supabase } from '../lib/supabase';
import { ensureThumbnailsBucketExists } from './storageBuckets';

/**
 * 检查文件大小，如果超过限制，返回 false
 * @param file 文件对象
 * @param maxSizeMB 最大文件大小（MB）
 * @returns 是否在大小限制内
 */
export const checkFileSize = (file: File, maxSizeMB: number = 50): boolean => {
  const fileSizeMB = file.size / (1024 * 1024);
  return fileSizeMB <= maxSizeMB;
};

/**
 * 获取文件的 MIME 类型
 * @param file 文件对象
 * @returns MIME 类型
 */
export const getFileMimeType = (file: File): string => {
  if (file.name.toLowerCase().endsWith('.glb')) {
    return 'model/gltf-binary';
  } else if (file.name.toLowerCase().endsWith('.gltf')) {
    return 'model/gltf+json';
  } else {
    return file.type || 'application/octet-stream';
  }
};

/**
 * 处理模型文件
 * 注意：当前版本直接返回原始文件，未实现实际压缩
 * @param file 模型文件
 * @returns 处理后的文件和元数据
 */
export const processModelFile = async (file: File): Promise<{
  processedFile: File | Blob;
  metadata: {
    originalSize: number;
    processedSize: number;
    compressionRatio: number;
    format: string;
  };
}> => {
  // 获取文件扩展名
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

  // 返回原始文件和元数据
  return {
    processedFile: file,
    metadata: {
      originalSize: file.size,
      processedSize: file.size,
      compressionRatio: 1,
      format: fileExtension
    }
  };
};



/**
 * 生成模型的缩略图
 * 注意：这个功能需要在 Canvas 环境中运行
 * @param modelUrl 模型的 URL
 * @returns 缩略图的 Data URL
 */
export const generateModelThumbnail = async (modelUrl: string): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      // 创建一个临时的 DOM 元素来挂载渲染器
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      document.body.appendChild(container);

      // 创建场景
      const scene = new THREE.Scene();
      scene.background = null; // 透明背景

      // 创建相机
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      camera.position.set(0, 0, 5);

      // 添加光源
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      // 创建渲染器
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
      renderer.setSize(256, 256);
      renderer.setClearColor(0x000000, 0); // 透明背景
      container.appendChild(renderer.domElement);

      // 创建控制器
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.screenSpacePanning = false;
      controls.maxPolarAngle = Math.PI / 2;

      // 加载模型
      const loader = new GLTFLoader();

      // 设置加载超时
      const timeoutId = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 10000); // 10秒超时

      loader.load(
        modelUrl,
        (gltf) => {
          clearTimeout(timeoutId);

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

          // 获取缩略图
          const dataUrl = renderer.domElement.toDataURL('image/png');

          // 清理资源
          cleanup();

          resolve(dataUrl);
        },
        undefined,
        (error) => {
          // 加载错误
          clearTimeout(timeoutId);
          cleanup();
          resolve(null);
        }
      );

      // 清理函数
      function cleanup() {
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        if (renderer) {
          renderer.dispose();
        }
        if (controls) {
          controls.dispose();
        }
      }

    } catch (error) {
      resolve(null);
    }
  });
};

/**
 * 上传缩略图到Supabase存储
 * @param thumbnailDataUrl 缩略图的Data URL
 * @param modelName 模型名称，用于生成缩略图文件名
 * @returns 缩略图的公共URL，如果上传失败则返回null
 */
export const uploadThumbnail = async (thumbnailDataUrl: string, modelName: string): Promise<string | null> => {
  try {
    // 确保thumbnails存储桶存在
    const bucketExists = await ensureThumbnailsBucketExists();
    if (!bucketExists) {
      return null;
    }

    // 从Data URL创建Blob
    const response = await fetch(thumbnailDataUrl);
    const blob = await response.blob();

    // 生成唯一的文件名
    const fileName = `${Date.now()}_${modelName.replace(/\.[^/.]+$/, '')}_thumbnail.png`;

    // 上传到Supabase
    const { data, error } = await supabase.storage
      .from('thumbnails')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: false
      });

    if (error) {
      return null;
    }

    // 获取公共URL
    const { data: { publicUrl } } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    return null;
  }
};

/**
 * 验证模型文件是否有效
 * @param file 模型文件
 * @returns 是否有效
 */
export const validateModelFile = async (file: File): Promise<boolean> => {
  // 检查文件扩展名
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!['glb', 'gltf', 'obj', 'fbx'].includes(fileExtension)) {
    return false;
  }

  // 检查文件大小
  if (!checkFileSize(file, 50)) {
    return false;
  }

  // 对于 GLB/GLTF 文件，可以尝试解析头部
  if (['glb', 'gltf'].includes(fileExtension)) {
    try {
      // 读取文件的前几个字节
      const buffer = await file.arrayBuffer();

      // 对于 GLB 文件，检查魔数
      if (fileExtension === 'glb') {
        const view = new DataView(buffer);
        const magic = view.getUint32(0, true);
        // GLB 文件的魔数是 0x46546C67 ('glTF' in ASCII)
        if (magic !== 0x46546C67) {
          return false;
        }
      }

      // 对于 GLTF 文件，尝试解析 JSON
      if (fileExtension === 'gltf') {
        const text = await file.text();
        try {
          const json = JSON.parse(text);
          if (!json.asset || !json.asset.version) {
            return false;
          }
        } catch {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  // 对于其他格式，我们只能基于扩展名和大小进行基本验证
  return true;
};
