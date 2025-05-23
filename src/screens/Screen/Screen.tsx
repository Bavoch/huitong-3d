import {
  BoxIcon,
  CopyIcon,
  DownloadIcon,
  HelpCircleIcon,
  SearchIcon,
  ShirtIcon,
  UploadIcon,
} from "lucide-react";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { supabase, type Model } from "../../lib/supabase";
import ModelViewer from "../../components/ModelViewer";
import ThumbnailGenerator from "../../components/ThumbnailGenerator";
import ModelListItem from "../../components/ModelListItem";
import {
  processModelFile,
  validateModelFile,
  checkFileSize,
  getFileMimeType,
  generateModelThumbnail,
  uploadThumbnail
} from "../../utils/modelProcessor";
import { preloadImages } from "../../utils/imageCache";
import { ensureModelsBucketExists, ensureThumbnailsBucketExists } from "../../utils/storageBuckets";

export const Screen = (): JSX.Element => {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [currentModel, setCurrentModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(false);
  const [customColor, setCustomColor] = useState("#FFFFFF");
  const [customRoughness, setCustomRoughness] = useState(0.5);
  const [customMetallic, setCustomMetallic] = useState(0);
  const [isCapturingMode, setIsCapturingMode] = useState(false);
  const [modelsNeedingThumbnails, setModelsNeedingThumbnails] = useState<Model[]>([]);
  const [processingThumbnails, setProcessingThumbnails] = useState(false);

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
      alert('请上传有效的3D模型文件（.glb, .gltf, .obj, .fbx）');
      return;
    }

    // 检查文件大小
    if (!checkFileSize(file, 50)) {
      alert('文件大小超过限制（最大50MB）');
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

      // 上传文件到Supabase存储桶
      try {
        // 设置正确的MIME类型
        const contentType = getFileMimeType(processedFile instanceof File ? processedFile : file);

        // 生成唯一文件名，避免覆盖
        const uniqueFileName = `${Date.now()}_${fileName}`;

        // 上传文件到Supabase存储桶
        const { data, error } = await supabase.storage
          .from('models')
          .upload(uniqueFileName, processedFile, {
            contentType,
            upsert: false // 不覆盖同名文件
          });

        if (error) {
          console.error('上传到Supabase失败:', error);
          alert('上传模型到存储桶失败，请稍后重试');

          // 清理本地资源
          URL.revokeObjectURL(fileURL);

          // 清空文件输入，允许再次上传
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

          return;
        }

        // 获取公共URL
        const { data: { publicUrl } } = supabase.storage.from('models').getPublicUrl(data.path);

        // 更新模型对象，使用存储桶URL
        newModel.file_path = publicUrl;

        // 确保缩略图存储桶存在
        await ensureThumbnailsBucketExists();

        // 生成并上传缩略图
        const thumbnailDataUrl = await generateModelThumbnail(publicUrl);

        if (thumbnailDataUrl) {
          const thumbnailUrl = await uploadThumbnail(thumbnailDataUrl, fileName);

          if (thumbnailUrl) {
            newModel.thumbnail_url = thumbnailUrl;
          }
        }

        // 添加到上传模型列表
        setUploadedModels(prev => [...prev, newModel]);

        // 自动选择新上传的模型
        setSelectedModel(newModel.id);
        setCurrentModel(newModel);

        // 重新获取所有模型，确保数据库和存储桶同步
        fetchModels();

        // 显示成功消息
        console.log('模型上传成功，已添加到存储桶');
      } catch (uploadError) {
        console.error('上传过程中出错:', uploadError);
        alert('上传过程中出错，请稍后重试');

        // 清理本地资源
        URL.revokeObjectURL(fileURL);
      }
    } catch (processingError) {
      console.error('处理模型文件时出错:', processingError);
      alert('处理模型文件时出错，请尝试其他文件');
    }

    // 清空文件输入，允许再次上传相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 删除单个上传的模型
  const deleteUploadedModel = (modelId: string) => {
    // 找到要删除的模型
    const modelToDelete = uploadedModels.find(m => m.id === modelId);
    if (!modelToDelete) return;

    // 释放对象URL
    if (modelToDelete.file_path.startsWith('blob:')) {
      URL.revokeObjectURL(modelToDelete.file_path);
    }

    // 从列表中移除模型
    setUploadedModels(prev => prev.filter(m => m.id !== modelId));

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

  // 从 Supabase 获取模型数据
  const fetchModels = async () => {
    setLoading(true);
    try {
      // 检查存储桶是否存在，如果不存在则创建
      await ensureModelsBucketExists();

      // 从存储桶获取模型文件
      const storageModels = await getModelsFromStorage();

      if (storageModels.length > 0) {
        setModels(storageModels);

        // 如果没有当前选中的模型，选择第一个
        if (!currentModel && !showUploadedModels) {
          setSelectedModel(storageModels[0].id);
          setCurrentModel(storageModels[0]);
        }

        // 同步数据库中的模型记录
        await syncModelsWithDatabase(storageModels);

        // 检查哪些模型需要生成缩略图
        const needThumbnails = storageModels.filter(model =>
          !model.thumbnail_url ||
          model.thumbnail_url.includes('placehold.co')
        );

        if (needThumbnails.length > 0) {
          setModelsNeedingThumbnails(needThumbnails);
        } else {
          setModelsNeedingThumbnails([]);

          // 预加载所有缩略图
          const thumbnailUrls = storageModels
            .filter(model => model.thumbnail_url && !model.thumbnail_url.includes('placehold.co'))
            .map(model => model.thumbnail_url as string);

          if (thumbnailUrls.length > 0) {
            preloadImages(thumbnailUrls);
          }
        }
      } else {
        setModels([]);
        setModelsNeedingThumbnails([]);
      }
    } catch (error) {
      console.error('获取模型时出错:', error);
    } finally {
      setLoading(false);
    }
  };



  // 从存储桶获取模型
  const getModelsFromStorage = async (): Promise<Model[]> => {
    try {
      // 列出存储桶中的文件
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('models')
        .list();

      if (storageError) {
        console.error('获取存储桶数据错误:', storageError);
        return [];
      }

      if (!storageData || storageData.length === 0) {
        return [];
      }

      // 过滤出3D模型文件
      const modelFiles = storageData.filter(file => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        return ['glb', 'gltf', 'obj', 'fbx'].includes(extension || '');
      });

      if (modelFiles.length === 0) {
        return [];
      }

      // 将存储桶中的文件转换为模型数据格式
      const storageModels: Model[] = await Promise.all(modelFiles.map(async (file) => {
        // 获取文件的公共URL
        const { data: { publicUrl } } = supabase
          .storage
          .from('models')
          .getPublicUrl(file.name);

        // 查询数据库中是否已有该模型的记录和缩略图
        const { data: existingModels, error: queryError } = await supabase
          .from('models')
          .select('*')
          .eq('file_path', publicUrl)
          .limit(1);

        // 如果数据库中已有记录且有缩略图，使用现有缩略图
        let thumbnailUrl = null;
        if (!queryError && existingModels && existingModels.length > 0 && existingModels[0].thumbnail_url) {
          thumbnailUrl = existingModels[0].thumbnail_url;
        }

        return {
          id: `storage_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: file.name,
          description: `存储桶中的模型: ${file.name}`,
          file_path: publicUrl,
          thumbnail_url: thumbnailUrl,
          created_at: file.created_at || new Date().toISOString(),
          updated_at: file.updated_at || new Date().toISOString()
        };
      }));

      return storageModels;
    } catch (error) {
      console.error('从存储桶获取模型时出错:', error);
      return [];
    }
  };

  // 同步数据库中的模型记录
  const syncModelsWithDatabase = async (storageModels: Model[]) => {
    try {
      // 获取数据库中现有的模型记录
      const { data: existingModels, error: fetchError } = await supabase
        .from('models')
        .select('*');

      if (fetchError) {
        console.error('获取现有模型记录失败:', fetchError);
        return;
      }

      // 创建一个映射，用于快速查找文件路径对应的现有记录
      const existingModelMap = new Map();
      existingModels.forEach(model => {
        existingModelMap.set(model.file_path, model);
      });

      // 跟踪已处理的文件路径
      const processedFilePaths = new Set();

      // 为每个存储桶中的模型创建或更新记录
      for (const model of storageModels) {
        processedFilePaths.add(model.file_path);

        // 检查是否已存在相同文件路径的记录
        const existingModel = existingModelMap.get(model.file_path);

        // 如果没有缩略图，尝试生成一个
        let thumbnailUrl = model.thumbnail_url;
        if (!thumbnailUrl && (!existingModel || !existingModel.thumbnail_url || existingModel.thumbnail_url.includes('placehold.co'))) {
          const thumbnailDataUrl = await generateModelThumbnail(model.file_path);
          if (thumbnailDataUrl) {
            thumbnailUrl = await uploadThumbnail(thumbnailDataUrl, model.name);
            if (thumbnailUrl) {
              model.thumbnail_url = thumbnailUrl;
            }
          }
        } else if (existingModel && existingModel.thumbnail_url && !existingModel.thumbnail_url.includes('placehold.co')) {
          // 使用现有的缩略图
          thumbnailUrl = existingModel.thumbnail_url;
        }

        if (existingModel) {
          // 更新现有记录
          const { error: updateError } = await supabase
            .from('models')
            .update({
              name: model.name,
              description: model.description,
              thumbnail_url: thumbnailUrl || existingModel.thumbnail_url,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingModel.id);

          if (updateError) {
            console.error(`更新模型 ${model.name} 记录失败:`, updateError);
          }
        } else {
          // 创建新记录
          const { error: insertError } = await supabase
            .from('models')
            .insert([{
              name: model.name,
              description: model.description,
              file_path: model.file_path,
              thumbnail_url: thumbnailUrl,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (insertError) {
            console.error(`保存模型 ${model.name} 到表中出错:`, insertError);
          }
        }
      }

      // 删除存储桶中不存在的记录
      const recordsToDelete = existingModels.filter(model => !processedFilePaths.has(model.file_path));

      if (recordsToDelete.length > 0) {
        for (const model of recordsToDelete) {
          const { error: deleteError } = await supabase
            .from('models')
            .delete()
            .eq('id', model.id);

          if (deleteError) {
            console.error(`删除模型记录 ${model.id} 失败:`, deleteError);
          }
        }
      }
    } catch (error) {
      console.error('同步数据库记录时出错:', error);
    }
  };

  // 处理缩略图生成完成事件
  const handleThumbnailGenerated = useCallback((modelId: string, thumbnailUrl: string) => {
    // 更新模型列表中的缩略图URL
    setModels(prevModels =>
      prevModels.map(model =>
        model.id === modelId
          ? { ...model, thumbnail_url: thumbnailUrl }
          : model
      )
    );

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
    fetchModels();
  }, []);

  // 面板宽度状态
  const [sidebarWidth, setSidebarWidth] = useState<number>(220);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // 材质数据状态
  const [materials, setMaterials] = useState<Array<{
    id: number;
    name: string;
    color: string;
    roughness: number;
    metallic: number;
    imagePath: string;
  }>>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number>(0);

  // 模型上的材质状态
  const [modelMaterials, setModelMaterials] = useState<Array<{
    id: number;
    materialId: number;
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
            { id: 1, materialId: 0 }, // 金属
            { id: 2, materialId: 5 }, // 塑料红
            { id: 3, materialId: 11 }, // 玻璃
            { id: 4, materialId: 22 }  // 珍珠
          ]);
        }
      } catch (error) {
        console.error('加载材质数据失败:', error);
        // 如果加载失败，使用默认材质数据
        const defaultMaterials = Array.from({ length: 24 }, (_, i) => ({
          id: i,
          name: `材质 ${i+1}`,
          color: '#FFFFFF',
          roughness: 0.5,
          metallic: 0,
          imagePath: `/materials/material-${i}.png`
        }));
        setMaterials(defaultMaterials);
        setModelMaterials([
          { id: 1, materialId: 0 },
          { id: 2, materialId: 1 },
          { id: 3, materialId: 2 },
          { id: 4, materialId: 3 }
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
          className="relative w-[78px] h-6 object-contain"
          alt="Logo"
          src="/Logo.png"
        />

        <div className="inline-flex items-center justify-end gap-2 relative">
          <Button
            variant="ghost"
            className="h-8 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
            onMouseEnter={() => setIsCapturingMode(true)}
            onMouseLeave={() => setIsCapturingMode(false)}
            onClick={() => {
              // 使用全局暴露的方法获取截图
              if (window && (window as any).captureModelScreenshot) {
                const dataURL = (window as any).captureModelScreenshot();
                if (dataURL) {
                  // 创建一个临时的canvas元素
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  const img = new Image();

                  img.onload = () => {
                    // 设置canvas大小与图像一致
                    canvas.width = img.width;
                    canvas.height = img.height;

                    // 绘制图像到canvas
                    ctx?.drawImage(img, 0, 0);

                    // 将canvas内容复制到剪贴板
                    canvas.toBlob((blob) => {
                      if (blob) {
                        try {
                          // 使用Clipboard API复制图像
                          navigator.clipboard.write([
                            new ClipboardItem({
                              [blob.type]: blob
                            })
                          ]).then(() => {
                            alert('图片已复制到剪贴板');
                            setIsCapturingMode(false);
                          }).catch(err => {
                            console.error('复制到剪贴板失败:', err);
                            alert('复制到剪贴板失败，请检查浏览器权限');
                            setIsCapturingMode(false);
                          });
                        } catch (e) {
                          console.error('复制到剪贴板时出错:', e);
                          alert('复制到剪贴板失败，请使用保存图片功能');
                          setIsCapturingMode(false);
                        }
                      }
                    });
                  };

                  img.src = dataURL;
                }
              } else {
                alert('无法获取模型截图，请稍后再试');
                setIsCapturingMode(false);
              }
            }}
          >
            <CopyIcon className="w-4 h-4 text-[#ffffffb2]" />
            <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal">
              复制图片
            </span>
          </Button>

          <Button
            className="h-8 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#2268eb] rounded-lg hover:bg-[#2268eb]/90"
            onMouseEnter={() => setIsCapturingMode(true)}
            onMouseLeave={() => setIsCapturingMode(false)}
            onClick={() => {
              // 使用全局暴露的方法获取截图
              if (window && (window as any).captureModelScreenshot) {
                const dataURL = (window as any).captureModelScreenshot();
                if (dataURL) {
                  // 创建下载链接
                  const link = document.createElement('a');
                  link.href = dataURL;
                  link.download = `${currentModel?.name || 'model'}_${new Date().toISOString().slice(0, 10)}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  setIsCapturingMode(false);
                }
              } else {
                alert('无法获取模型截图，请稍后再试');
                setIsCapturingMode(false);
              }
            }}
          >
            <DownloadIcon className="w-4 h-4" />
            <span className="mt-[-1.00px] text-white w-fit text-[14px] font-[500] leading-normal">
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
            {currentModel ? (
              <ModelViewer
                selectedModel={currentModel}
                customColor={customColor}
                customRoughness={customRoughness}
                customMetallic={customMetallic}
                isCapturingMode={isCapturingMode}
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

              {/* 模型卡片列表 */}
              <div className="max-h-[30vh] overflow-y-auto pr-1 mb-2 scrollbar-thin scrollbar-thumb-[#3a3a3a] scrollbar-track-transparent w-full">
                {loading ? (
                  <div className="p-4 text-center text-[#ffffff80] text-[14px] w-full">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <span>加载模型中...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 根据状态显示上传的模型或内置模型 */}
                    {(showUploadedModels ? uploadedModels : models).map((model) => (
                      <ModelListItem
                        key={model.id}
                        model={model}
                        isSelected={selectedModel === model.id}
                        onSelect={(modelId) => {
                          // 先清除当前模型，然后设置新模型，确保状态更新
                          setCurrentModel(null);
                          setSelectedModel('');

                          // 使用setTimeout确保状态更新后再设置新模型
                          setTimeout(() => {
                            setSelectedModel(modelId);
                            setCurrentModel(model);
                          }, 50);
                        }}
                        onDelete={showUploadedModels ? deleteUploadedModel : undefined}
                        showDeleteButton={showUploadedModels}
                      />
                    ))}

                    {/* 当没有模型时显示提示 */}
                    {(showUploadedModels ? uploadedModels : models).length === 0 && (
                      <div className="p-4 text-center text-[#ffffff80] text-[14px] w-full">
                        {showUploadedModels ? '没有上传的模型' : '没有可用的模型'}
                      </div>
                    )}
                  </>
                )}
              </div>

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
                    <div
                      className="absolute w-[27px] h-[27px] top-1.5 left-1.5 rounded-sm"
                      style={{
                        backgroundImage: `url(${materials.find(m => m.id === selectedMaterialId)?.imagePath || materials[0].imagePath})`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                      }}
                    />
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
                          <div
                            className="relative flex-1 self-stretch grow cursor-pointer"
                            style={{
                              backgroundImage: `url(${material.imagePath})`,
                              backgroundSize: "contain",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                              filter: "brightness(1.1) contrast(1.05)"
                            }}
                            title={`点击应用: ${material.name}`}
                          />
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