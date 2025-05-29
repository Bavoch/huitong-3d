import React, { memo } from 'react';
import { Model } from '../lib/supabase';
import ModelThumbnail from './ModelThumbnail';
import { TrashIcon } from 'lucide-react';

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
  const handleClick = () => {
    onSelect(model.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡到父元素
    if (onDelete) {
      onDelete(model.id);
    }
  };

  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer mb-1 ${
        isSelected ? 'bg-theme-blue' : 'hover:bg-[#ffffff1a]'
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

      {showDeleteButton && onDelete && (
        <button
          className={`p-1 rounded-md flex-shrink-0 ${
            isSelected ? 'hover:bg-[#4b83f0] text-white' : 'hover:bg-[#ffffff1a] text-[#ffffff80]'
          }`}
          onClick={handleDelete}
          title="删除模型"
        >
          <TrashIcon size={16} className="flex-shrink-0" />
        </button>
      )}
    </div>
  );
};

// 使用React.memo包装组件，避免不必要的重新渲染
export default memo(ModelListItem, (prevProps, nextProps) => {
  return (
    prevProps.model.id === nextProps.model.id &&
    prevProps.model.name === nextProps.model.name &&
    prevProps.model.thumbnail_url === nextProps.model.thumbnail_url &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showDeleteButton === nextProps.showDeleteButton
  );
});
