/**
 * 本地文件存储管理工具
 * 用于替代之前的Supabase存储桶功能
 */

/**
 * 生成唯一文件名
 * @param fileName 原始文件名
 * @returns 添加时间戳的唯一文件名
 */
export const generateUniqueFileName = (fileName: string): string => {
  return `${Date.now()}_${fileName}`;
};

/**
 * 保存文件到内存中，生成URL
 * @param file 文件对象
 * @returns 文件的blob URL
 */
export const saveFileToMemory = (file: File | Blob): string => {
  return URL.createObjectURL(file);
};

/**
 * 释放内存中的文件URL
 * @param url Blob URL
 */
export const releaseFileFromMemory = (url: string): void => {
  URL.revokeObjectURL(url);
};

/**
 * 检查文件类型是否允许
 * @param file 文件对象
 * @param allowedTypes 允许的MIME类型数组
 * @returns 是否允许
 */
export const isFileTypeAllowed = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.type) || allowedTypes.some(type => 
    file.name.toLowerCase().endsWith(type.replace('application/', '.').replace('model/', '.'))
  );
};

/**
 * 检查文件大小是否在限制范围内
 * @param file 文件对象
 * @param maxSizeMB 最大文件大小(MB)
 * @returns 是否在限制范围内
 */
export const isFileSizeAllowed = (file: File, maxSizeMB: number): boolean => {
  return file.size <= maxSizeMB * 1024 * 1024;
};

/**
 * 模拟存储桶配置类型
 */
export type StorageBucket = {
  name: string;
  isPublic: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
};

// 预定义的存储桶
const buckets: Record<string, StorageBucket> = {
  models: {
    name: 'models',
    isPublic: true,
    fileSizeLimit: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream', '.glb', '.gltf', '.obj', '.fbx']
  },
  thumbnails: {
    name: 'thumbnails',
    isPublic: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', '.png', '.jpg', '.jpeg']
  }
};

/**
 * 获取存储桶配置
 * @param bucketName 存储桶名称
 * @returns 存储桶配置
 */
export const getBucket = (bucketName: string): StorageBucket | null => {
  return buckets[bucketName] || null;
};

/**
 * 确保模型存储桶存在
 * @returns 总是返回true，因为我们使用内存存储
 */
export const ensureModelsBucketExists = async (): Promise<boolean> => {
  return true;
};

/**
 * 确保缩略图存储桶存在
 * @returns 总是返回true，因为我们使用内存存储
 */
export const ensureThumbnailsBucketExists = async (): Promise<boolean> => {
  return true;
};
