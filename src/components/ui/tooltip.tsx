import React, { useState, useEffect, ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [containerNode, setContainerNode] = useState<HTMLElement | null>(null);
  
  // 监听窗口尺寸变化，更新提示位置
  useEffect(() => {
    const handleResize = () => {
      if (containerNode) {
        updateTooltipPosition(containerNode);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [containerNode]);
  
  // 当悬停状态或容器元素改变时更新提示位置
  useEffect(() => {
    if (isVisible && containerNode) {
      updateTooltipPosition(containerNode);
    }
  }, [isVisible, containerNode, position]);
  
  // 计算提示框的位置
  const updateTooltipPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const newPosition = { top: 0, left: 0 };
    
    switch (position) {
      case 'top':
        newPosition.top = rect.top - 10; // 放在元素的上方
        newPosition.left = rect.left + rect.width / 2;
        break;
      case 'right':
        newPosition.top = rect.top + rect.height / 2;
        newPosition.left = rect.right + 10; // 放在元素的右侧
        break;
      case 'bottom':
        newPosition.top = rect.bottom + 10; // 放在元素的下方
        newPosition.left = rect.left + rect.width / 2;
        break;
      case 'left':
        newPosition.top = rect.top + rect.height / 2;
        newPosition.left = rect.left - 10; // 放在元素的左侧
        break;
    }
    
    setTooltipPosition(newPosition);
  };
  
  // 根据位置获取样式
  const getTooltipStyles = () => {
    const styles: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
      pointerEvents: 'none',
    };
    
    switch (position) {
      case 'top':
        styles.bottom = window.innerHeight - tooltipPosition.top;
        styles.left = tooltipPosition.left;
        styles.transform = 'translateX(-50%)';
        break;
      case 'right':
        styles.top = tooltipPosition.top;
        styles.left = tooltipPosition.left;
        styles.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        styles.top = tooltipPosition.top;
        styles.left = tooltipPosition.left;
        styles.transform = 'translateX(-50%)';
        break;
      case 'left':
        styles.top = tooltipPosition.top;
        styles.right = window.innerWidth - tooltipPosition.left;
        styles.transform = 'translateY(-50%)';
        break;
    }
    
    return styles;
  };
  
  // 获取三角形指示器的CSS类
  const getArrowClass = () => {
    switch (position) {
      case 'top':
        return 'bottom-[-5px] left-1/2 transform -translate-x-1/2 border-t-[#252525] border-x-transparent border-b-transparent border-x-[5px] border-t-[5px]';
      case 'right':
        return 'left-[-5px] top-1/2 transform -translate-y-1/2 border-r-[#252525] border-y-transparent border-l-transparent border-y-[5px] border-r-[5px]';
      case 'bottom':
        return 'top-[-5px] left-1/2 transform -translate-x-1/2 border-b-[#252525] border-x-transparent border-t-transparent border-x-[5px] border-b-[5px]';
      case 'left':
        return 'right-[-5px] top-1/2 transform -translate-y-1/2 border-l-[#252525] border-y-transparent border-r-transparent border-y-[5px] border-l-[5px]';
      default:
        return '';
    }
  };
  
  // 通过克隆添加鼠标事件和ref
  const enhancedChildren = React.cloneElement(children as React.ReactElement, {
    onMouseEnter: (e: React.MouseEvent) => {
      setIsVisible(true);
      setContainerNode(e.currentTarget as HTMLElement);
    },
    onMouseLeave: () => setIsVisible(false)
  });
  
  return (
    <>
      {enhancedChildren}
      
      {isVisible && containerNode && (
        <div style={getTooltipStyles()}>
          <div className="relative">
            {/* 提示内容 */}
            <div className="px-md py-sm bg-tooltip-bg text-text-primary text-sm font-medium rounded-lg shadow-lg max-w-[200px]">
              {content}
            </div>
            
            {/* 三角形指示器 */}
            <div className={`absolute w-0 h-0 border-solid ${getArrowClass()}`}></div>
          </div>
        </div>
      )}
    </>
  );
}
