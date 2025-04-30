/**
 * 图片缓存工具
 * 用于缓存缩略图URL，避免重复加载
 */

// 缓存键前缀
const CACHE_PREFIX = 'huitong3d_img_cache_';

// 内存缓存，用于快速访问
const memoryCache: Record<string, string> = {};

/**
 * 获取缓存的图片URL
 * @param key 缓存键，通常是模型ID
 * @returns 缓存的图片URL，如果没有缓存则返回null
 */
export const getCachedImageUrl = (key: string): string | null => {
  // 首先检查内存缓存
  if (memoryCache[key]) {
    return memoryCache[key];
  }

  // 然后检查localStorage
  try {
    const cachedUrl = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (cachedUrl) {
      // 更新内存缓存
      memoryCache[key] = cachedUrl;
      return cachedUrl;
    }
  } catch (error) {
    console.warn('读取图片缓存失败:', error);
  }

  return null;
};

/**
 * 缓存图片URL
 * @param key 缓存键，通常是模型ID
 * @param url 图片URL
 */
export const cacheImageUrl = (key: string, url: string): void => {
  // 更新内存缓存
  memoryCache[key] = url;

  // 更新localStorage
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, url);
  } catch (error) {
    console.warn('保存图片缓存失败:', error);
  }
};

/**
 * 清除指定键的图片缓存
 * @param key 缓存键，通常是模型ID
 */
export const clearImageCache = (key: string): void => {
  // 清除内存缓存
  delete memoryCache[key];

  // 清除localStorage
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.warn('清除图片缓存失败:', error);
  }
};

/**
 * 清除所有图片缓存
 */
export const clearAllImageCache = (): void => {
  // 清除内存缓存
  Object.keys(memoryCache).forEach(key => {
    delete memoryCache[key];
  });

  // 清除localStorage中的所有图片缓存
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.warn('清除所有图片缓存失败:', error);
  }
};

/**
 * 预加载图片
 * @param url 图片URL
 * @returns Promise，加载成功时解析为true，失败时解析为false
 */
export const preloadImage = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};

/**
 * 批量预加载图片
 * @param urls 图片URL数组
 * @returns Promise，解析为成功加载的图片数量
 */
export const preloadImages = async (urls: string[]): Promise<number> => {
  if (urls.length === 0) return 0;

  const results = await Promise.allSettled(
    urls.map(url => preloadImage(url))
  );
  return results.filter(result => result.status === 'fulfilled' && result.value).length;
};
