import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon } from 'lucide-react';

// 通知类型
export type ToastType = 'success' | 'error' | 'info';

// 通知接口
interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

// 通知上下文接口
interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

// 创建通知上下文
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// 通知提供者组件
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 添加通知
  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prevToasts) => [...prevToasts, { id, type, message, duration }]);
  }, []);

  // 移除通知
  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  // 上下文值
  const contextValue = {
    showToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {typeof window !== 'undefined' &&
        createPortal(
          <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
              <ToastItem
                key={toast.id}
                toast={toast}
                onClose={() => removeToast(toast.id)}
              />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

// 通知项组件
const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({
  toast,
  onClose,
}) => {
  const { type, message, duration } = toast;

  // 自动关闭
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // 获取图标
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircleIcon className="w-5 h-5 text-red-500" />;
      case 'info':
      default:
        return <InfoIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  // 获取背景色
  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'info':
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <div
      className={`min-w-[300px] max-w-md px-4 py-3 rounded-lg shadow-md border ${getBgColor()} text-gray-700 dark:text-gray-200 flex items-center gap-3 animate-slideIn`}
      style={{
        animation: 'slideIn 0.3s ease-out forwards, fadeOut 0.3s ease-out forwards',
        animationDelay: `0s, ${duration - 300}ms`,
      }}
    >
      {getIcon()}
      <div className="flex-1">{message}</div>
      <button
        onClick={onClose}
        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

// 使用通知的钩子
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// 单例模式，提供全局访问方法
let toastFunction: ((message: string, type?: ToastType, duration?: number) => void) | null = null;

export const setToastFunction = (fn: (message: string, type?: ToastType, duration?: number) => void) => {
  toastFunction = fn;
};

export const toast = {
  show: (message: string, type?: ToastType, duration?: number) => {
    if (toastFunction) {
      toastFunction(message, type, duration);
    } else {
      console.warn('Toast function not set yet. Make sure ToastProvider is mounted.');
    }
  },
  success: (message: string, duration?: number) => {
    toast.show(message, 'success', duration);
  },
  error: (message: string, duration?: number) => {
    toast.show(message, 'error', duration);
  },
  info: (message: string, duration?: number) => {
    toast.show(message, 'info', duration);
  },
};
