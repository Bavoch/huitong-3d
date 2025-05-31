import {
  BoxIcon,
  CopyIcon,
  DownloadIcon,
  HelpCircleIcon,
  SearchIcon,
  ShirtIcon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { getModels, saveModel, deleteModel, updateModelThumbnail, type Model } from "../../lib/localStorage";
import ModelViewer from "../../components/ModelViewer";
import ThumbnailGenerator from "../../components/ThumbnailGenerator";
import ModelSelect from "../../components/ModelSelect";
import {
  processModelFile,
  validateModelFile,
  checkFileSize,
  generateModelThumbnail,
} from "../../utils/modelProcessor";
import { preloadImages } from "../../utils/imageCache";
import { ensureModelsBucketExists } from "../../utils/storageBuckets";
import { MaterialThumbnail, captureMaterialThumbnail } from '../../components/MaterialThumbnail';
import { toast } from '../../components/ui/toast';
import { getMaterials, Material } from '../../lib/materialStorage';
import { base64ToBlob, extractMimeType } from '../../utils/blobUtils';

export const Screen = (): JSX.Element => {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [currentModel, setCurrentModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(false);
  const [customColor, setCustomColor] = useState("#FFFFFF");
  const [customRoughness, setCustomRoughness] = useState(0.5);
  const [customMetallic, setCustomMetallic] = useState(0);
  const [modelsNeedingThumbnails, setModelsNeedingThumbnails] = useState<Model[]>([]);
  const [processingThumbnails, setProcessingThumbnails] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout>();
  const [effectiveModel, setEffectiveModel] = useState<Model | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null; // 存储 blob URL 以便清理

    if (currentModel && currentModel.file_path) {
      if (currentModel.file_path.startsWith('data:')) {
        // 处理旧版 Base64 数据 URL
        const mimeType = extractMimeType(currentModel.file_path) || 'application/octet-stream';
        const blob = base64ToBlob(currentModel.file_path, mimeType);
        objectUrl = URL.createObjectURL(blob);
        setEffectiveModel({ ...currentModel, file_path: objectUrl });
      } else if (currentModel.file_path.startsWith('/models/')) {
        // 处理服务器上的模型文件
        // 确定基础URL
        const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? `http://${window.location.hostname}:9000`
          : '';
        
        const fullPath = `${baseUrl}${currentModel.file_path}`;
        console.log('加载服务器模型路径:', fullPath);
        setEffectiveModel({ ...currentModel, file_path: fullPath });
      } else {
        // 其他URL类型 (例如 blob: URL 或 HTTP URL)
        setEffectiveModel(currentModel);
      }
    } else {
      setEffectiveModel(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [currentModel]);

  // 处理logo点击事件
  const handleLogoClick = useCallback(() => {
    // 清除之前的计时器
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    // 增加点击计数
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    // 设置超时重置计数（1秒内点击三次）
    clickTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 1000);
    
    // 如果点击了三次，跳转到管理后台
    if (newCount >= 3) {
      setClickCount(0);
      window.location.href = '/admin';
    }
  }, [clickCount]);

  // 上传模型相关状态
  const [uploadedModels, setUploadedModels] = useState<Model[]>([]);
  const [showUploadedModels, setShowUploadedModels] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileName = file.name;

    // 使用模型处理工具验证文件
    const isValid = await validateModelFile(file);
    if (!isValid) {
      toast.error('请上传有效的3D模型文件（.glb, .gltf, .obj, .fbx）');
      return;
    }

    // 检查文件大小
    if (!checkFileSize(file, 50)) {
      toast.error('文件大小超过限制（最大50MB）');
      return;
    }

    try {
      // 处理模型文件（压缩和优化）
      const { processedFile, metadata } = await processModelFile(file);

      // 创建文件URL用于本地预览
      const fileURL = URL.createObjectURL(processedFile);

      // 创建新的模型对象用于本地预览
      const currentTime = new Date().toISOString();
      const newModel: Model = {
        id: `uploaded-${Date.now()}`,
        name: fileName,
        file_path: fileURL,
        description: `上传的模型: ${fileName} (${(metadata.processedSize / (1024 * 1024)).toFixed(2)}MB)`,
        created_at: currentTime,
        updated_at: currentTime
      };

      // 确保存储桶存在
      await ensureModelsBucketExists();

      // 保存文件到本地存储
      try {
        // 使用已创建的本地URL作为文件路径
        const publicUrl = fileURL;
        
        // 文件路径已经在创建模型时设置为fileURL

        // 保持使用已创建的本地URL
        newModel.file_path = publicUrl;

        // 生成缩略图
        const thumbnailDataUrl = await generateModelThumbnail(publicUrl);

        if (thumbnailDataUrl) {
          // 直接将缩略图数据URL保存到模型对象中
          newModel.thumbnail_url = thumbnailDataUrl;
        }

        // 将模型保存到本地存储
        saveModel(newModel);
        
        // 添加到上传模型列表
        setUploadedModels(prev => [...prev, newModel]);

        // 自动选择新上传的模型
        setSelectedModel(newModel.id);
        setCurrentModel(newModel);

        // 重新获取所有模型
        fetchModels();

        // 显示成功消息
        // 模型上传成功
      } catch (uploadError) {
        console.error('上传过程中出错:', uploadError);
        toast.error('上传过程中出错，请稍后重试');

        // 清理本地资源
        URL.revokeObjectURL(fileURL);
      }
    } catch (processingError) {
      console.error('处理模型文件时出错:', processingError);
      toast.error('处理模型文件时出错，请尝试其他文件');
    }

    // 清空文件输入，允许再次上传相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 删除单个上传的模型
  const deleteUploadedModel = (modelId: string) => {
    // 找到要删除的模型
    const modelToDelete = uploadedModels.find(model => model.id === modelId);
    if (!modelToDelete) return;

    // 如果是记忆URL，释放内存
    if (modelToDelete.file_path.startsWith('blob:')) {
      URL.revokeObjectURL(modelToDelete.file_path);
    }
    if (modelToDelete.thumbnail_url?.startsWith('blob:')) {
      URL.revokeObjectURL(modelToDelete.thumbnail_url);
    }
    
    // 使用本地存储删除模型
    deleteModel(modelId);

    // 如果删除的是当前选中的模型，选择另一个模型
    if (modelId === selectedModel) {
      const remainingModels = uploadedModels.filter(m => m.id !== modelId);
      if (remainingModels.length > 0) {
        // 还有其他上传的模型，选择第一个
        setSelectedModel(remainingModels[0].id);
        setCurrentModel(remainingModels[0]);
      } else if (models.length > 0 && showUploadedModels) {
        // 没有其他上传的模型，切换回内置模型
        setShowUploadedModels(false);
        setSelectedModel(models[0].id);
        setCurrentModel(models[0]);
      } else {
        // 没有任何模型可用
        setSelectedModel("");
        setCurrentModel(null);
      }
    }

    // 如果删除后没有上传的模型了，切换回内置模型
    if (uploadedModels.length === 1 && models.length > 0) { // 当前只有一个上传模型，即将删除的模型
      setShowUploadedModels(false);
    }
  };

  // 清除所有上传的模型
  const clearUploadedModels = () => {
    // 释放所有创建的对象URL
    uploadedModels.forEach(model => {
      if (model.file_path.startsWith('blob:')) {
        URL.revokeObjectURL(model.file_path);
      }
    });

    // 清空上传模型列表
    setUploadedModels([]);

    // 切换回显示内置模型
    setShowUploadedModels(false);

    // 如果有内置模型，选择第一个
    if (models.length > 0) {
      setSelectedModel(models[0].id);
      setCurrentModel(models[0]);
    } else {
      setSelectedModel("");
      setCurrentModel(null);
    }
  };

  // 从本地存储获取模型数据
  const fetchModels = async () => {
    setLoading(true);
    try {
      // 检查存储桶是否存在，对于本地存储来说总是存在的
      await ensureModelsBucketExists();

      // 从本地存储获取模型
      let localModels = getModels();
      

      if (localModels.length > 0) {
        setModels(localModels);

        // 如果没有当前选中的模型，选择第一个
        if (!currentModel && !showUploadedModels) {
          setSelectedModel(localModels[0].id);
          setCurrentModel(localModels[0]);
        }
        
        // 本地存储不需要额外同步

        // 检查哪些模型需要生成缩略图
        const needThumbnails = localModels.filter(model => 
          !model.thumbnail_url || model.thumbnail_url.includes('placehold.co'));

        if (needThumbnails.length > 0) {
          // 添加到缩略图生成队列
          setModelsNeedingThumbnails(needThumbnails);
          
          // 如果当前没有正在处理缩略图，开始处理
          if (!processingThumbnails) {
            setProcessingThumbnails(true);
          }
        } else {
          // 预加载所有缩略图
          const thumbnailUrls = localModels
            .filter(model => model.thumbnail_url && !model.thumbnail_url.includes('placehold.co'))
            .map(model => model.thumbnail_url as string);

          if (thumbnailUrls.length > 0) {
            preloadImages(thumbnailUrls);
          }
        }
      } else {
        setModels([]);
        setCurrentModel(null);
        setSelectedModel("");
        setModelsNeedingThumbnails([]);
      }
    } catch (error) {
      console.error('获取模型时出错:', error);
    } finally {
      setLoading(false);
    }
  };



  // 从本地存储获取模型 - 已内联到fetchModels中
  // 同步模型数据到本地存储 - 已通过直接调用saveModel/deleteModel实现

  // 处理缩略图生成完成事件
  const handleThumbnailGenerated = useCallback((modelId: string, thumbnailUrl: string) => {
    // 更新模型列表中的缩略图URL
    setModels(prevModels => {
      const updatedModels = prevModels.map(model =>
        model.id === modelId
          ? { ...model, thumbnail_url: thumbnailUrl }
          : model
      );
      
      // 使用本地存储更新缩略图
      updateModelThumbnail(modelId, thumbnailUrl);
      
      return updatedModels;
    });

    // 从需要生成缩略图的列表中移除该模型
    setModelsNeedingThumbnails(prevModels =>
      prevModels.filter(model => model.id !== modelId)
    );

    // 预加载新生成的缩略图
    if (thumbnailUrl && !thumbnailUrl.includes('placehold.co')) {
      preloadImages([thumbnailUrl]);
    }
  }, []);

  // 处理缩略图生成
  const processNextThumbnail = useCallback(() => {
    if (modelsNeedingThumbnails.length > 0 && !processingThumbnails) {
      setProcessingThumbnails(true);

      // 从列表中移除第一个模型
      setModelsNeedingThumbnails(prevModels => prevModels.slice(1));
    }
  }, [modelsNeedingThumbnails, processingThumbnails]);

  // 监听需要生成缩略图的模型列表变化
  useEffect(() => {
    if (modelsNeedingThumbnails.length > 0 && !processingThumbnails) {
      processNextThumbnail();
    }
  }, [modelsNeedingThumbnails, processingThumbnails, processNextThumbnail]);

  // 首次加载时获取模型数据
  useEffect(() => {
    // 在组件初始化时主动清理所有本地存储数据
    // clearLocalStorage(); // 自动清除本地存储，导致模型丢失，暂时注释掉
    
    // 设置一个短暂的延时，确保清理完成后再获取模型
    setTimeout(() => {
      // 获取模型和设置缓存
      fetchModels();
    }, 100);
  }, []);

  // 面板宽度状态
  const [sidebarWidth, setSidebarWidth] = useState<number>(220);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // 材质数据状态
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");

  // 模型上的材质状态
  const [modelMaterials, setModelMaterials] = useState<Array<{
    id: number;
    materialId: string;
  }>>([]);
  const [selectedModelMaterialIndex, setSelectedModelMaterialIndex] = useState<number>(0);

  // 处理分隔线上的鼠标按下事件
  const handleDividerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // 阻止事件冒泡

    // 防止文本选择
    document.body.style.userSelect = 'none';
    // 添加拖拽时的全局样式
    document.body.style.cursor = 'col-resize';

    // 开始拖拽 - 设置状态会触发useEffect添加事件监听器
    setIsDragging(true);

    // 防止默认拖拽行为
    e.preventDefault();
  }, []);

  // 处理拖拽移动
  const handleDragMove = useCallback((e: MouseEvent) => {
    // 如果不在拖拽状态或没有引用到主内容区域，则返回
    if (!isDragging || !mainContentRef.current) {
      return;
    }

    // 获取容器尺寸和鼠标位置
    const containerRect = mainContentRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;

    // 计算新的侧边栏宽度，确保在合理范围内
    let newWidth = containerWidth - mouseX;

    // 设置最小和最大宽度限制
    const minWidth = 180;
    const maxWidth = Math.min(400, containerWidth * 0.5);

    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    // 直接设置宽度
    setSidebarWidth(newWidth);
  }, [isDragging]);

  // 处理拖拽结束
  const handleDragEnd = useCallback(() => {
    // 恢复样式
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    // 设置拖拽状态为false - 会触发useEffect移除事件监听器
    setIsDragging(false);
  }, []);

  // 全局事件处理器，确保在任何情况下都能正确清理
  useEffect(() => {
    // 添加全局鼠标抬起事件处理器，作为安全措施
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };

    // 添加全局按键事件处理器，按ESC键结束拖拽
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDragging) {
        handleDragEnd();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleDragEnd, handleDragMove]);

  // 监听isDragging状态变化
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);

      // 清理函数，组件卸载或依赖项变化时执行
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 加载材质数据
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        // 从本地存储加载材质数据
        const materialsFromStorage = getMaterials();
        if (materialsFromStorage.length === 0) {
          // 如果本地没有数据，从默认配置加载
          const response = await fetch('/materials/materials.json');
          if (!response.ok) {
            throw new Error('无法加载材质数据');
          }
          const data = await response.json();
          setMaterials(data);
          if (data.length > 0) {
            setSelectedMaterialId(data[0].id);
            // 应用第一个材质的属性
            setCustomColor(data[0].color);
            setCustomRoughness(data[0].roughness);
            setCustomMetallic(data[0].metallic);

            // 初始化模型材质
            // 模拟一个模型有四个不同的材质部分
            setModelMaterials([
              { id: 1, materialId: data[0].id }, // 默认使用第一个材质
              { id: 2, materialId: data.length > 5 ? data[5].id : data[0].id },
              { id: 3, materialId: data.length > 10 ? data[10].id : data[0].id },
              { id: 4, materialId: data.length > 15 ? data[15].id : data[0].id }
            ]);
          }
        } else {
          // 直接使用从materialStorage.ts中获取的材质数据
          setMaterials(materialsFromStorage);
          if (materialsFromStorage.length > 0) {
            setSelectedMaterialId(materialsFromStorage[0].id);
            // 应用第一个材质的属性
            setCustomColor(materialsFromStorage[0].color);
            setCustomRoughness(materialsFromStorage[0].roughness);
            setCustomMetallic(materialsFromStorage[0].metallic);

            // 初始化模型材质
            setModelMaterials([
              { id: 1, materialId: materialsFromStorage[0].id }, // 默认使用第一个材质
              { id: 2, materialId: materialsFromStorage.length > 5 ? materialsFromStorage[5].id : materialsFromStorage[0].id },
              { id: 3, materialId: materialsFromStorage.length > 10 ? materialsFromStorage[10].id : materialsFromStorage[0].id },
              { id: 4, materialId: materialsFromStorage.length > 15 ? materialsFromStorage[15].id : materialsFromStorage[0].id }
            ]);
          }
        }
      } catch (error) {
        console.error('加载材质数据失败:', error);
        // 如果加载失败，使用默认材质数据
        // 创建符合Material类型的默认材质
        const now = new Date().toISOString();
        const defaultMaterials: Material[] = Array.from({ length: 5 }, (_, i) => ({
          id: `default-${i}`,
          name: `材质 ${i+1}`,
          description: null,
          color: i === 0 ? '#FFFFFF' : i === 1 ? '#FF5252' : i === 2 ? '#4285F4' : i === 3 ? '#0F9D58' : '#FFEB3B',
          roughness: 0.5,
          metallic: i === 0 ? 1 : 0,
          created_at: now,
          updated_at: now
        }));
        setMaterials(defaultMaterials);
        setSelectedMaterialId(defaultMaterials[0].id);
        setCustomColor(defaultMaterials[0].color);
        setCustomRoughness(defaultMaterials[0].roughness);
        setCustomMetallic(defaultMaterials[0].metallic);
        
        setModelMaterials([
          { id: 1, materialId: defaultMaterials[0].id },
          { id: 2, materialId: defaultMaterials[0].id },
          { id: 3, materialId: defaultMaterials[0].id },
          { id: 4, materialId: defaultMaterials[0].id }
        ]);
      }
    };

    fetchMaterials();
  }, []);

  // 添加窗口大小变化监听
  useEffect(() => {
    // 调整内容区域高度的函数
    const adjustContentHeight = () => {
      if (mainContentRef.current) {
        const windowHeight = window.innerHeight;
        const headerHeight = 64; // 头部高度 + padding
        const contentHeight = windowHeight - headerHeight;
        mainContentRef.current.style.height = `${contentHeight}px`;
      }
    };

    // 初始调整
    adjustContentHeight();

    // 监听窗口大小变化
    window.addEventListener('resize', adjustContentHeight);

    // 清理函数
    return () => {
      window.removeEventListener('resize', adjustContentHeight);
    };
  }, [sidebarWidth]);

  return (
    <main className="flex flex-col h-screen items-start gap-5 p-5 relative bg-[#191919] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between pl-2 pr-0 py-0 relative self-stretch w-full flex-shrink-0">
        <img
          className="relative w-[78px] h-6 object-contain cursor-pointer"
          alt="Logo"
          src="/Logo.png"
          onClick={handleLogoClick}
          title="点击三次进入管理后台"
          style={{ cursor: 'pointer' }}
        />

        <div className="inline-flex items-center justify-end gap-2 relative">
          <Button
            variant="ghost"
            className="h-8 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
            onClick={() => {
              const dataUrl = captureMaterialThumbnail();
              if (dataUrl) {
                // 将图片数据复制到剪贴板
                // 创建一个临时的canvas元素
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) {
                  toast.error('无法创建临时画布，复制失败');
                  return;
                }
                
                // 创建一个新的图像对象
                const img = new Image();
                img.onload = () => {
                  // 设置canvas大小与图像相同
                  tempCanvas.width = img.width;
                  tempCanvas.height = img.height;
                  // 绘制图像到canvas
                  tempCtx.drawImage(img, 0, 0);
                  
                  // 尝试复制到剪贴板
                  tempCanvas.toBlob(blob => {
                    if (blob) {
                      // 创建ClipboardItem
                      const item = new ClipboardItem({ 'image/png': blob });
                      navigator.clipboard.write([item])
                        .then(() => toast.success('图片已复制到剪贴板'))
                        .catch(err => {
                          console.error('复制到剪贴板失败:', err);
                          toast.error('复制到剪贴板失败，可能是浏览器权限问题');
                        });
                    }
                  }, 'image/png');
                };
                img.src = dataUrl;
              } else {
                toast.error('无法获取材质预览图片');
              }
            }}
          >
            <CopyIcon className="w-4 h-4 text-[#ffffffb2]" />
            <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal">
              复制图片
            </span>
          </Button>

          <Button
            variant="default"
            className="h-8 inline-flex items-center justify-center gap-1 px-3 py-1.5 btn-primary rounded-lg"
            onClick={() => {
              const dataUrl = captureMaterialThumbnail();
              if (dataUrl) {
                // 创建一个下载链接
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = `材质_${new Date().getTime()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              } else {
                toast.error('无法获取材质预览图片');
              }
            }}
          >
            <DownloadIcon className="w-4 h-4" />
            <span className="w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal">
              保存图片
            </span>
          </Button>
        </div>
      </header>

      {/* Main content area - 使用flex-1确保填充剩余空间 */}
      <div ref={mainContentRef} className="flex items-stretch relative w-full flex-1 overflow-hidden">
        {/* 3D Preview Area */}
        <Card className="relative flex-1 bg-[#ffffff0d] rounded-2xl overflow-hidden border-0 h-full">
          <CardContent className="p-0 h-full relative">
            {effectiveModel ? (
              <ModelViewer
                selectedModel={effectiveModel}
                customColor={customColor}
                customRoughness={customRoughness}
                customMetallic={customMetallic}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white opacity-50">
                请选择一个模型
              </div>
            )}

            <Button
              variant="ghost"
              className="inline-flex items-center gap-1.5 px-2 py-1 absolute bottom-4 right-4 bg-[#ffffff0d] rounded-[99px] hover:bg-[#ffffff1a] z-10"
            >
              <HelpCircleIcon className="w-4 h-4" />
              <span className="text-[#ffffff66] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal">
                操作说明
              </span>
            </Button>
          </CardContent>
        </Card>

        {/* 可拖拽分隔线区域 - 只在悬停时显示 */}
        <div
          className="relative w-5 mx-0 self-stretch cursor-col-resize group bg-transparent hover:bg-[#ffffff0d]"
          onMouseDown={handleDividerMouseDown}
          title="拖拽调整宽度"
          id="divider-handle"
        >
          {/* 实际的分隔线 - 只在悬停或拖拽时显示 */}
          <div
            className={`absolute left-1/2 transform -translate-x-1/2 w-[2px] h-full transition-all duration-200 ${
              isDragging ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-transparent group-hover:bg-blue-500'
            }`}
          ></div>
        </div>

        {/* Sidebar */}
        <Card
          className="flex flex-col items-start gap-4 p-3 relative bg-[#ffffff0d] rounded-2xl border-0 h-full overflow-hidden"
          style={{ width: `${sidebarWidth}px` }}>
          <CardContent className="p-0 space-y-4 w-full h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[#3a3a3a] scrollbar-track-transparent max-w-full flex flex-col">
            {/* Model Selection Section */}
            <div className="flex flex-col items-start gap-2 relative self-stretch w-full">
              <div className="inline-flex items-center gap-1 relative">
                <BoxIcon className="w-4 h-4 text-[#ffffffb2]" />
                <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal">
                  模型
                </span>
              </div>

              {/* 模型选择下拉框 */}
              <div className="mb-2 w-full">
                {loading ? (
                  <div className="p-4 text-center text-[#ffffff80] text-[14px] w-full">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <span>加载模型中...</span>
                    </div>
                  </div>
                ) : (
                  <ModelSelect
                    models={showUploadedModels ? uploadedModels : models}
                    selectedModel={selectedModel}
                    onSelect={(modelId: string) => {
                      // 先清除当前模型，然后设置新模型，确保状态更新
                      setCurrentModel(null);
                      setSelectedModel('');

                      // 使用setTimeout确保状态更新后再设置新模型
                      setTimeout(() => {
                        setSelectedModel(modelId);
                        const model = (showUploadedModels ? uploadedModels : models).find(m => m.id === modelId);
                        if (model) {
                          setCurrentModel(model);
                        }
                      }, 50);
                    }}
                    onDelete={showUploadedModels ? deleteUploadedModel : undefined}
                    showDeleteButton={showUploadedModels}
                  />
                )}
              </div>
              
              {/* 上传的模型管理按钮 */}

              <input
                type="file"
                ref={fileInputRef}
                accept=".glb,.gltf,.obj,.fbx"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="flex gap-2 w-full">
                <Button
                  variant="ghost"
                  className="h-8 flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon className="w-4 h-4 text-[#ffffffb2] flex-shrink-0" />
                  <span className="text-[#ffffffb2] mt-[-1.00px] text-[14px] font-[500] leading-normal truncate">
                    上传模型
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  className="h-8 flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
                  onClick={fetchModels}
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#ffffffb2] flex-shrink-0">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                    <path d="M16 21h5v-5"></path>
                  </svg>
                  <span className="text-[#ffffffb2] mt-[-1.00px] text-[14px] font-[500] leading-normal truncate">
                    刷新模型
                  </span>
                </Button>
              </div>
              {uploadedModels.length > 0 && (
                <div className="flex gap-2 mt-2 w-full">
                  <Button
                    variant="ghost"
                    className="h-8 flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
                    onClick={() => setShowUploadedModels(true)}
                  >
                    <span className={`text-[#ffffffb2] mt-[-1.00px] text-[14px] font-[500] leading-normal truncate ${showUploadedModels ? 'text-[#2268eb]' : ''}`}>
                      上传模型
                    </span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="h-8 flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
                    onClick={() => setShowUploadedModels(false)}
                  >
                    <span className={`text-[#ffffffb2] mt-[-1.00px] text-[14px] font-[500] leading-normal truncate ${!showUploadedModels ? 'text-[#2268eb]' : ''}`}>
                      内置模型
                    </span>
                  </Button>
                </div>
              )}

              {uploadedModels.length > 0 && (
                <Button
                  variant="ghost"
                  className="h-8 w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33] mt-2"
                  onClick={clearUploadedModels}
                >
                  <span className="text-[#ffffffb2] mt-[-1.00px] text-[14px] font-[500] leading-normal truncate">
                    清除所有上传模型
                  </span>
                </Button>
              )}
            </div>

            {/* Material Settings Section */}
            <div className="flex flex-col items-start gap-2 relative flex-1 self-stretch w-full">
              <div className="inline-flex items-center gap-1 relative">
                <ShirtIcon className="w-4 h-4 text-[#ffffffb2]" />
                <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal">
                  材质设置
                </span>
              </div>

              {/* Applied Materials - 当前模型上的材质 */}
              <div className="flex items-start gap-2 flex-wrap relative self-stretch w-full">
                {/* 只显示一个材质球 */}
                {materials.length > 0 && (
                  <div
                    className="relative w-10 h-10 bg-[#ffffff0d] rounded-lg cursor-pointer transition-all hover:bg-[#ffffff1a] border border-solid border-[#2268eb]"
                    onClick={() => {
                      // 已经选中当前材质
                      setSelectedModelMaterialIndex(0);
                      // 显示其对应的材质属性
                      const material = materials.find(m => m.id === selectedMaterialId);
                      if (material) {
                        setCustomColor(material.color);
                        setCustomRoughness(material.roughness);
                        setCustomMetallic(material.metallic);
                      }
                    }}
                  >
                    <div className="absolute w-[27px] h-[27px] top-1.5 left-1.5 rounded-sm">
                      {materials.length > 0 && (
                        <MaterialThumbnail 
                          color={materials.find(m => m.id === selectedMaterialId)?.color || materials[0].color}
                          roughness={materials.find(m => m.id === selectedMaterialId)?.roughness || materials[0].roughness}
                          metallic={materials.find(m => m.id === selectedMaterialId)?.metallic || materials[0].metallic}
                          size={27}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Material Type Tabs */}
              <Tabs defaultValue="standard" className="w-full flex-1 flex flex-col">
                <TabsList className="h-9 p-1 w-full bg-[#ffffff0d] rounded-lg grid grid-cols-2">
                  <TabsTrigger
                    value="standard"
                    className="h-7 px-0 py-1.5 data-[state=active]:bg-[#ffffff1f] data-[state=active]:text-[#ffffffe6] data-[state=inactive]:text-[#ffffffb2] rounded-md text-[14px] font-[500] leading-normal"
                  >
                    会通材料
                  </TabsTrigger>
                  <TabsTrigger
                    value="custom"
                    className="h-7 px-0 py-1.5 data-[state=active]:bg-[#ffffff1f] data-[state=active]:text-[#ffffffe6] data-[state=inactive]:text-[#ffffffb2] rounded-md text-[14px] font-[500] leading-normal"
                  >
                    自定义
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="standard" className="mt-3 p-0 flex-1 flex flex-col">
                  <div className="flex flex-col items-start gap-3 relative flex-1 self-stretch w-full rounded-2xl">
                    {/* Search Input */}
                    <div className="flex items-center gap-1 px-2 py-1.5 relative self-stretch w-full bg-[#00000026] rounded-lg overflow-hidden">
                      <SearchIcon className="w-4 h-4 text-[#ffffff66]" />
                      <Input
                        className="border-0 bg-transparent text-[#ffffff66] text-[14px] font-[500] leading-normal p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="搜索"
                      />
                    </div>

                    {/* Material Grid */}
                    <div className="flex flex-wrap w-full items-start content-start gap-[8px] relative flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#3a3a3a] scrollbar-track-transparent">
                      {materials.map((material) => (
                        <div
                          key={material.id}
                          className={`flex w-[calc(33.33%-6px)] h-[60px] items-center gap-1 p-2.5 relative bg-[#ffffff0d] rounded-lg overflow-hidden ${material.id === selectedMaterialId ? "border border-solid border-[#2268eb]" : ""}`}
                          onClick={() => {
                            // 选中这个材质
                            setSelectedMaterialId(material.id);
                            setCustomColor(material.color);
                            setCustomRoughness(material.roughness);
                            setCustomMetallic(material.metallic);

                            // 应用到当前选中的模型材质部分
                            if (selectedModelMaterialIndex !== undefined && selectedModelMaterialIndex >= 0) {
                              const updatedModelMaterials = [...modelMaterials];
                              updatedModelMaterials[selectedModelMaterialIndex] = {
                                ...updatedModelMaterials[selectedModelMaterialIndex],
                                materialId: material.id
                              };
                              setModelMaterials(updatedModelMaterials);
                            }
                          }}
                        >
                          <div className="relative flex-1 self-stretch grow cursor-pointer flex items-center justify-center p-1" title={`点击应用: ${material.name}`}>
                            <MaterialThumbnail 
                              color={material.color}
                              roughness={material.roughness}
                              metallic={material.metallic}
                              size={40}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="custom" className="mt-3 space-y-4">
                  {/* Color Picker */}
                  <div className="space-y-2 w-full">
                    <label className="text-[#ffffffb2] text-[14px] font-[500] leading-normal">颜色</label>
                    <div className="flex gap-2 w-full">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="w-8 h-8 bg-[#00000026] rounded-lg border-0 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none flex-shrink-0"
                      />
                      <Input
                        value={customColor.toUpperCase()}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="flex-1 min-w-0 h-8 px-2 py-1.5 bg-[#00000026] text-[#ffffffe6] text-[14px] font-[500] leading-normal border-0 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 uppercase"
                      />
                    </div>
                  </div>

                  {/* Roughness Slider */}
                  <div className="space-y-2 w-full">
                    <div className="flex justify-between w-full">
                      <label className="text-[#ffffffb2] text-[14px] font-[500] leading-normal">粗糙度</label>
                      <span className="text-[#ffffff66] text-[14px] font-[500] leading-normal">{customRoughness}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={customRoughness}
                      onChange={(e) => setCustomRoughness(parseFloat(e.target.value))}
                      className="w-full h-1 bg-[#ffffff1a] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                  </div>

                  {/* Metallic Slider */}
                  <div className="space-y-2 w-full">
                    <div className="flex justify-between w-full">
                      <label className="text-[#ffffffb2] text-[14px] font-[500] leading-normal">金属度</label>
                      <span className="text-[#ffffff66] text-[14px] font-[500] leading-normal">{customMetallic}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={customMetallic}
                      onChange={(e) => setCustomMetallic(parseFloat(e.target.value))}
                      className="w-full h-1 bg-[#ffffff1a] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 缩略图生成器 - 不可见组件 */}
      {processingThumbnails && modelsNeedingThumbnails.length > 0 && (
        <ThumbnailGenerator
          model={modelsNeedingThumbnails[0]}
          onThumbnailGenerated={(thumbnailUrl) => {
            handleThumbnailGenerated(modelsNeedingThumbnails[0].id, thumbnailUrl);
            setProcessingThumbnails(false);
          }}
        />
      )}
    </main>
  );
};