import React, { useEffect, useState, memo } from 'react';
import { BoxIcon } from 'lucide-react';
import { getCachedImageUrl, cacheImageUrl, preloadImage } from '../utils/imageCache';

interface ModelThumbnailProps {
  id: string;
  thumbnailUrl: string | null | undefined;
  className?: string;
}

/**
 * 模型缩略图组件
 * 使用缓存机制避免重复加载缩略图
 */
const ModelThumbnail: React.FC<ModelThumbnailProps> = ({ id, thumbnailUrl, className = '' }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // 如果没有提供缩略图URL或者是占位图，显示默认图标
    if (!thumbnailUrl || thumbnailUrl.includes('placehold.co')) {
      setDisplayUrl(null);
      setIsLoaded(false);
      setLoadError(false);
      return;
    }

    // 尝试从缓存获取图片URL
    const cachedUrl = getCachedImageUrl(id);
    if (cachedUrl) {
      setDisplayUrl(cachedUrl);
      setIsLoaded(true);
      return;
    }

    // 如果缓存中没有，使用提供的URL并预加载
    setDisplayUrl(thumbnailUrl);
    setIsLoaded(false);
    setLoadError(false);

    // 预加载图片
    preloadImage(thumbnailUrl).then(success => {
      if (success) {
        cacheImageUrl(id, thumbnailUrl);
        setIsLoaded(true);
      } else {
        setLoadError(true);
      }
    });
  }, [id, thumbnailUrl]);

  // 如果没有URL或加载失败，显示默认图标
  if (!displayUrl || loadError) {
    return (
      <div className={`w-8 h-8 flex-shrink-0 bg-[#ffffff1a] rounded-md flex items-center justify-center ${className}`}>
        <BoxIcon className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className={`w-8 h-8 flex-shrink-0 bg-[#ffffff1a] rounded-md flex items-center justify-center overflow-hidden ${className}`}>
      <img
        src={displayUrl}
        alt="模型缩略图"
        className={`w-full h-full object-cover transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setLoadError(true)}
        loading="lazy"
      />
    </div>
  );
};

export default memo(ModelThumbnail);
