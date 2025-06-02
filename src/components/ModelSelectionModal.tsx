import React, { useState, useEffect, useRef } from 'react';
import { Model } from '../lib/supabase';
import { SearchIcon, XIcon } from 'lucide-react';
import ModelThumbnail from './ModelThumbnail';

interface ModelSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  onDelete?: (modelId: string) => void;
  showDeleteButton?: boolean;
  triggerRef?: React.RefObject<HTMLElement>;
}

const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({
  isOpen,
  onClose,
  models,
  selectedModel,
  onSelect,
  onDelete,
  showDeleteButton = false,
  triggerRef
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredModels, setFilteredModels] = useState<Model[]>(models);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  // 过滤模型
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredModels(models);
    } else {
      const filtered = models.filter(model =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredModels(filtered);
    }
  }, [searchQuery, models]);

  // 处理选择模型
  const handleSelectModel = (modelId: string) => {
    onSelect(modelId);
  };

  // 处理删除模型
  const handleDeleteModel = (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(modelId);
    }
  };

  // 计算弹窗位置
  useEffect(() => {
    if (isOpen && triggerRef?.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 400; // 弹窗宽度
      const popoverHeight = 500; // 弹窗最大高度

      // 默认显示在左侧
      let left = triggerRect.left - popoverWidth - 8; // 左侧8px间距
      let top = triggerRect.top;

      // 如果左侧空间不足，则显示在右侧
      if (left < 8) {
        left = triggerRect.right + 8;
      }

      // 如果右侧也没有足够空间，则尝试显示在下方
      if (left + popoverWidth > window.innerWidth - 8) {
        left = triggerRect.left;
        top = triggerRect.bottom + 8;
      }

      // 检查下边界，如果下方空间不足则显示在上方
      if (top + popoverHeight > window.innerHeight - 8) {
        top = Math.max(8, triggerRect.top - popoverHeight);
      }

      setPosition({ top, left });
    }
  }, [isOpen, triggerRef]);

  // 处理键盘事件和点击外部关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  // 控制弹窗的显示和隐藏动画
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      // 延迟隐藏，等待动画完成
      const timer = setTimeout(() => {
        setIsVisible(false);
        setSearchQuery('');
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className={`fixed w-[400px] max-h-[500px] bg-[#262626] border border-[#ffffff1a] rounded-lg shadow-lg z-50 transition-opacity duration-200 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-[#ffffff1a]">
        <h2 className="text-white text-lg font-semibold">选择模型</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-md hover:bg-[#ffffff1a] text-[#ffffff80] hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18"></path>
            <path d="M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      {/* 搜索框 */}
      <div className="p-4 border-b border-[#ffffff1a]">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff66]" />
          <input
            type="text"
            placeholder="搜索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-[#1a1a1a] border border-[#ffffff1a] rounded-lg text-white placeholder-[#ffffff66] focus:outline-none focus:border-[#2268eb] transition-colors"
          />
        </div>
      </div>

      {/* 模型网格 */}
      <div className="flex-1 overflow-y-auto p-4 max-h-[350px]">
        {filteredModels.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {filteredModels.map((model) => (
              <div
                key={model.id}
                className={`relative aspect-square bg-[#1a1a1a] rounded-lg cursor-pointer transition-all hover:bg-[#2a2a2a] group ${
                  model.id === selectedModel ? 'ring-2 ring-[#2268eb] bg-[#2268eb1a]' : ''
                }`}
                onClick={() => handleSelectModel(model.id)}
              >
                {/* 模型缩略图 */}
                <div className="w-full h-full p-3 flex items-center justify-center">
                  <ModelThumbnail
                    id={model.id}
                    thumbnailUrl={model.thumbnail_url}
                    className="w-full h-full max-w-[70px] max-h-[70px]"
                  />
                </div>

                {/* 删除按钮 */}
                {showDeleteButton && onDelete && (
                  <button
                    className="absolute top-2 right-2 p-1 rounded-md bg-[#ff4444] hover:bg-[#ff6666] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteModel(e, model.id)}
                    title="删除模型"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-[#ffffff66]">
            <SearchIcon className="w-8 h-8 mb-2" />
            <p className="text-sm font-medium">没有找到模型</p>
            <p className="text-xs">尝试调整搜索条件</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelSelectionModal;