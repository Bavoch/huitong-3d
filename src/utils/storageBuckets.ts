/**
 * 存储管理工具
 * 已经从Supabase迁移到本地存储
 */

import { getBucket } from './fileStorage';

/**
 * 确保指定名称的存储桶存在
 * @param bucketName 存储桶名称
 * @param options 存储桶配置选项
 * @returns 是否成功确保存储桶存在
 */
export const ensureBucketExists = async (bucketName: string): Promise<boolean> => {
  try {
    const bucket = getBucket(bucketName);
    if (!bucket) {
      // 没有找到指定存储桶
      return false;
    }
    // 存储桶已存在
    return true;
  } catch (error) {
    console.error(`检查存储桶"${bucketName}"时出错:`, error);
    return false;
  }
};

/**
 * 确保models存储桶存在
 * @returns 是否成功确保存储桶存在
 */
export const ensureModelsBucketExists = async (): Promise<boolean> => {
  // 模型存储桶名称
  const bucketName = 'models';
  
  return ensureBucketExists(bucketName);
};

/**
 * 确保thumbnails存储桶存在
 * @returns 是否成功确保存储桶存在
 */
export const ensureThumbnailsBucketExists = async (): Promise<boolean> => {
  // 缩略图存储桶名称
  const bucketName = 'thumbnails';
  
  return ensureBucketExists(bucketName);
};
