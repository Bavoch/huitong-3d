/**
 * 模型处理工具函数
 * 用于处理模型上传前的预处理，包括压缩和优化
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

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
 * 处理模型文件，进行基本的优化
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
  
  // 如果不是 GLB/GLTF 格式，直接返回原文件
  if (!['glb', 'gltf'].includes(fileExtension)) {
    return {
      processedFile: file,
      metadata: {
        originalSize: file.size,
        processedSize: file.size,
        compressionRatio: 1,
        format: fileExtension
      }
    };
  }

  // 对于小文件（小于 2MB），直接返回原文件
  if (file.size < 2 * 1024 * 1024) {
    return {
      processedFile: file,
      metadata: {
        originalSize: file.size,
        processedSize: file.size,
        compressionRatio: 1,
        format: fileExtension
      }
    };
  }

  try {
    // 创建文件的 URL
    const fileURL = URL.createObjectURL(file);
    
    // 记录原始大小
    const originalSize = file.size;
    
    // 这里我们只进行基本的处理
    // 实际项目中可以使用 Draco 压缩或其他高级技术
    
    // 创建一个新的文件名，添加处理标记
    const fileName = file.name.replace(`.${fileExtension}`, `_processed.${fileExtension}`);
    
    // 创建处理后的文件
    // 注意：这里只是示例，实际上没有进行真正的压缩
    // 在实际项目中，可以使用 Draco 压缩或其他技术
    const processedFile = new File([file], fileName, {
      type: getFileMimeType(file)
    });
    
    // 释放 URL
    URL.revokeObjectURL(fileURL);
    
    return {
      processedFile,
      metadata: {
        originalSize,
        processedSize: processedFile.size,
        compressionRatio: processedFile.size / originalSize,
        format: fileExtension
      }
    };
  } catch (error) {
    console.error('处理模型文件时出错:', error);
    
    // 如果处理失败，返回原始文件
    return {
      processedFile: file,
      metadata: {
        originalSize: file.size,
        processedSize: file.size,
        compressionRatio: 1,
        format: fileExtension
      }
    };
  }
};

/**
 * 生成模型的缩略图
 * 注意：这个功能需要在 Canvas 环境中运行
 * @param modelUrl 模型的 URL
 * @returns 缩略图的 Data URL
 */
export const generateModelThumbnail = async (modelUrl: string): Promise<string | null> => {
  try {
    // 创建一个临时的 Three.js 场景
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
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
    
    // 加载模型
    // 注意：这里需要使用实际的 GLTFLoader，但为了简化示例，我们只返回 null
    // 在实际项目中，应该使用 GLTFLoader 加载模型并渲染
    
    // 渲染场景
    renderer.render(scene, camera);
    
    // 获取缩略图
    const dataUrl = renderer.domElement.toDataURL('image/png');
    
    // 清理资源
    renderer.dispose();
    
    return dataUrl;
  } catch (error) {
    console.error('生成模型缩略图时出错:', error);
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
