import React, { useState, useRef, useEffect } from 'react';
import { Model } from '../lib/supabase';
import { ChevronDownIcon } from 'lucide-react';
import ModelSelectionModal from './ModelSelectionModal';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  // 获取当前选中的模型
  const currentModel = models.find(model => model.id === selectedModel);

  // 处理选择模型
  const handleSelectModel = (modelId: string) => {
    onSelect(modelId);
    setIsModalOpen(false);
  };

  // 处理删除模型
  const handleDeleteModel = (modelId: string) => {
    if (onDelete) {
      onDelete(modelId);
    }
  };

  // 移除点击外部关闭的逻辑，因为现在使用模态窗口

  return (
    <div className="relative w-full">
      {/* 下拉框触发器 */}
      <div
        ref={triggerRef}
        className={`w-full h-8 px-sm py-1.5 bg-input-bg rounded-lg outline outline-1 outline-offset-[-1px] ${isModalOpen ? 'outline-border-emphasis' : 'outline-border-subtle'} inline-flex justify-between items-center overflow-hidden cursor-pointer`}
        onClick={() => setIsModalOpen(true)}
      >
        {currentModel ? (
          <div className="justify-start text-text-primary text-base font-normal truncate flex-1">
              {currentModel.name}
          </div>
        ) : (
          <div className="justify-start text-text-primary text-base font-normal">请选择</div>
        )}
        <div className="ChevronDown w-4 h-4 relative overflow-hidden">
          <ChevronDownIcon className="w-4 h-4 text-text-primary" />
        </div>
      </div>

      {/* 模型选择弹窗 */}
      <ModelSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        models={models}
        selectedModel={selectedModel}
        onSelect={handleSelectModel}
        onDelete={showDeleteButton ? handleDeleteModel : undefined}
        showDeleteButton={showDeleteButton}
        triggerRef={triggerRef}
      />
    </div>
  );
};

export default ModelSelect;
