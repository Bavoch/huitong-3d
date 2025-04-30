/**
 * Supabase存储桶管理工具
 * 用于创建和管理存储桶
 */

import { supabase } from '../lib/supabase';

/**
 * 确保指定名称的存储桶存在
 * @param bucketName 存储桶名称
 * @param options 存储桶配置选项
 * @returns 是否成功确保存储桶存在
 */
export const ensureBucketExists = async (
  bucketName: string, 
  options: {
    public?: boolean;
    fileSizeLimit?: number;
    allowedMimeTypes?: string[];
  } = {}
): Promise<boolean> => {
  try {
    // 检查存储桶是否存在
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();

    if (bucketsError) {
      console.error(`获取存储桶列表错误:`, bucketsError);
      return false;
    }

    // 检查是否有指定名称的存储桶
    const bucket = buckets.find(bucket => bucket.name === bucketName);
    if (!bucket) {
      console.log(`没有找到名为"${bucketName}"的存储桶，尝试创建...`);
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: options.public ?? true,
        fileSizeLimit: options.fileSizeLimit,
        allowedMimeTypes: options.allowedMimeTypes
      });

      if (error) {
        console.error(`创建存储桶"${bucketName}"失败:`, error);
        return false;
      } else {
        console.log(`成功创建"${bucketName}"存储桶`);
        return true;
      }
    } else {
      console.log(`找到"${bucketName}"存储桶`);
      return true;
    }
  } catch (error) {
    console.error(`检查/创建存储桶"${bucketName}"时出错:`, error);
    return false;
  }
};

/**
 * 确保models存储桶存在
 * @returns 是否成功确保存储桶存在
 */
export const ensureModelsBucketExists = async (): Promise<boolean> => {
  return ensureBucketExists('models', {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream']
  });
};

/**
 * 确保thumbnails存储桶存在
 * @returns 是否成功确保存储桶存在
 */
export const ensureThumbnailsBucketExists = async (): Promise<boolean> => {
  return ensureBucketExists('thumbnails', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg']
  });
};
