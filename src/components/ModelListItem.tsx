import React, { memo } from 'react';
import { Model } from '../lib/supabase';
import ModelThumbnail from './ModelThumbnail';

interface ModelListItemProps {
  model: Model;
  isSelected: boolean;
  onSelect: (modelId: string) => void;
  onDelete?: (modelId: string) => void;
  showDeleteButton?: boolean;
}

/**
 * 模型列表项组件
 * 使用React.memo优化渲染性能
 */
const ModelListItem: React.FC<ModelListItemProps> = ({ 
  model, 
  isSelected, 
  onSelect, 
  onDelete,
  showDeleteButton = false
}) => {
  // 处理点击事件
  const handleClick = () => {
    onSelect(model.id);
  };

  // 处理删除按钮点击事件
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡到父元素
    if (onDelete) {
      onDelete(model.id);
    }
  };

  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer mb-1 ${
        isSelected ? 'bg-[#3a6fd8]' : 'hover:bg-[#ffffff1a]'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-2 overflow-hidden max-w-[calc(100%-28px)] flex-1">
        <ModelThumbnail 
          id={model.id} 
          thumbnailUrl={model.thumbnail_url} 
        />
        <span className="text-[14px] font-[500] truncate min-w-0 flex-1">
          {model.name}
        </span>
      </div>

      {/* 删除按钮，只在需要时显示 */}
      {showDeleteButton && onDelete && (
        <button
          className={`p-1 rounded-md flex-shrink-0 ${
            isSelected ? 'hover:bg-[#4b83f0] text-white' : 'hover:bg-[#ffffff1a] text-[#ffffff80]'
          }`}
          onClick={handleDelete}
          title="删除模型"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="flex-shrink-0"
          >
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      )}
    </div>
  );
};

// 使用React.memo包装组件，避免不必要的重新渲染
// 只有当props发生变化时才会重新渲染
export default memo(ModelListItem, (prevProps, nextProps) => {
  // 自定义比较函数，只有在这些属性变化时才重新渲染
  return (
    prevProps.model.id === nextProps.model.id &&
    prevProps.model.name === nextProps.model.name &&
    prevProps.model.thumbnail_url === nextProps.model.thumbnail_url &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showDeleteButton === nextProps.showDeleteButton
  );
});
