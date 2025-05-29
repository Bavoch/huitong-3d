import React, { useState, useRef, useEffect } from 'react';
import { Model } from '../lib/supabase';
import { ChevronDownIcon } from 'lucide-react';
import ModelThumbnail from './ModelThumbnail';

interface ModelSelectProps {
  models: Model[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  onDelete?: (modelId: string) => void;
  showDeleteButton?: boolean;
}

const ModelSelect: React.FC<ModelSelectProps> = ({
  models,
  selectedModel,
  onSelect,
  onDelete,
  showDeleteButton = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 获取当前选中的模型
  const currentModel = models.find(model => model.id === selectedModel);

  // 处理选择模型
  const handleSelectModel = (modelId: string) => {
    onSelect(modelId);
    setIsOpen(false);
  };
  
  // 处理删除模型
  const handleDeleteModel = (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation(); // 阻止事件冒泡到父元素
    if (onDelete) {
      onDelete(modelId);
    }
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* 下拉框触发器 */}
      <div 
        className={`w-full h-8 px-2 py-1.5 bg-输入框/20 rounded-lg outline outline-1 outline-offset-[-1px] ${isOpen ? 'outline-品牌色' : 'outline-边框/10'} inline-flex justify-between items-center overflow-hidden cursor-pointer`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {currentModel ? (
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <ModelThumbnail
              id={currentModel.id}
              thumbnailUrl={currentModel.thumbnail_url}
            />
            <div className="justify-start text-white text-sm font-normal truncate">
              {currentModel.name}
            </div>
          </div>
        ) : (
          <div className="justify-start text-white text-sm font-normal">请选择</div>
        )}
        <div className="ChevronDown w-4 h-4 relative overflow-hidden">
          <ChevronDownIcon className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-[#262626] border border-边框/10 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {models.length > 0 ? (
            models.map((model) => (
              <div
                key={model.id}
                className={`flex items-center justify-between px-2 py-1.5 hover:bg-[#ffffff1a] cursor-pointer ${
                  model.id === selectedModel ? 'bg-[#2268eb33]' : ''
                }`}
                onClick={() => handleSelectModel(model.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden max-w-[calc(100%-28px)] flex-1">
                  <ModelThumbnail
                    id={model.id}
                    thumbnailUrl={model.thumbnail_url}
                  />
                  <span className="text-[14px] font-normal text-white truncate">
                    {model.name}
                  </span>
                </div>
                
                {showDeleteButton && onDelete && (
                  <button
                    className={`p-1 rounded-md flex-shrink-0 ${
                      model.id === selectedModel ? 'hover:bg-[#4b83f0] text-white' : 'hover:bg-[#ffffff1a] text-white'
                    }`}
                    onClick={(e) => handleDeleteModel(e, model.id)}
                    title="删除模型"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-2 text-center text-white text-sm">
              没有可用的模型
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelSelect;
