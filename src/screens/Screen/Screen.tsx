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
// 移除未使用的Select相关导入
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { supabase, type Model } from "../../lib/supabase";
import ModelViewer from "../../components/ModelViewer";

export const Screen = (): JSX.Element => {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [currentModel, setCurrentModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(false);
  const [customColor, setCustomColor] = useState("#FFFFFF");
  const [customRoughness, setCustomRoughness] = useState(0.5);
  const [customMetallic, setCustomMetallic] = useState(0);

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
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    const validExtensions = ['glb', 'gltf', 'obj', 'fbx'];

    if (!validExtensions.includes(fileExtension)) {
      alert('请上传有效的3D模型文件（.glb, .gltf, .obj, .fbx）');
      return;
    }

    // 创建文件URL
    const fileURL = URL.createObjectURL(file);

    // 创建新的模型对象
    const currentTime = new Date().toISOString();
    const newModel: Model = {
      id: `uploaded-${Date.now()}`,
      name: fileName,
      file_path: fileURL,
      description: `上传的模型: ${fileName}`,
      created_at: currentTime,
      updated_at: currentTime
    };

    // 尝试将文件上传到Supabase Storage
    try {
      // 上传文件到Supabase存储桶
      const { data, error } = await supabase.storage
        .from('models')
        .upload(`${Date.now()}_${fileName}`, file);

      if (error) {
        console.error('上传到Supabase失败:', error);
        // 即使上传失败，仍然在本地显示模型
      } else {
        console.log('模型文件已上传到Supabase:', data);
        // 获取公共URL并替换本地URL
        const { data: { publicUrl } } = supabase.storage.from('models').getPublicUrl(data.path);

        // 创建模型记录
        const { data: modelData, error: modelError } = await supabase
          .from('models')
          .insert([
            {
              name: fileName,
              file_path: publicUrl,
              description: `上传的模型: ${fileName}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])
          .select();

        if (modelError) {
          console.error('添加模型记录失败:', modelError);
        } else {
          console.log('成功添加模型记录:', modelData);
          // 使用返回的数据更新模型URL
          if (modelData && modelData.length > 0) {
            newModel.id = modelData[0].id;
            newModel.file_path = publicUrl;
          }
        }
      }
    } catch (uploadError) {
      console.error('上传过程中出错:', uploadError);
    }

    // 添加到上传模型列表
    setUploadedModels(prev => [...prev, newModel]);

    // 切换到显示上传模型
    setShowUploadedModels(true);

    // 自动选择新上传的模型
    setSelectedModel(newModel.id);
    setCurrentModel(newModel);

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
      // 首先尝试从 models 表中获取所有模型数据
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('*')
        .order('created_at', { ascending: false }); // 按创建时间降序排列，最新的在前面

      if (modelError) {
        console.error('获取模型数据错误:', modelError);
      }

      // 如果有模型数据，使用它
      if (modelData && modelData.length > 0) {
        console.log('从 Supabase 表中获取到的模型数据:', modelData);

        // 确保每个模型都有有效的ID（字符串类型）
        const processedModels = modelData.map(model => ({
          ...model,
          id: model.id.toString() // 确保ID是字符串类型
        }));

        setModels(processedModels);

        // 如果没有当前选中的模型，选择第一个
        if (!currentModel && !showUploadedModels) {
          setSelectedModel(processedModels[0].id);
          setCurrentModel(processedModels[0]);
        }
      } else {
        console.log('models表中没有找到模型数据，尝试加载示例模型');

        // 尝试加载示例模型数据
        try {
          const response = await fetch('/sample-models/sample-models.json');
          if (response.ok) {
            const sampleModels = await response.json();
            console.log('加载示例模型数据:', sampleModels);

            setModels(sampleModels);

            // 如果没有当前选中的模型，选择第一个
            if (!currentModel && !showUploadedModels) {
              setSelectedModel(sampleModels[0].id);
              setCurrentModel(sampleModels[0]);
            }

            // 尝试将示例模型保存到 Supabase
            for (const model of sampleModels) {
              try {
                const { error: insertError } = await supabase
                  .from('models')
                  .insert([{
                    name: model.name,
                    description: model.description,
                    file_path: model.file_path,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }]);

                if (insertError) {
                  console.error(`保存示例模型 ${model.name} 到 Supabase 失败:`, insertError);
                } else {
                  console.log(`成功保存示例模型 ${model.name} 到 Supabase`);
                }
              } catch (insertErr) {
                console.error(`保存示例模型 ${model.name} 时出错:`, insertErr);
              }
            }

            // 加载示例模型后返回，不再尝试从存储桶获取
            setLoading(false);
            return;
          }
        } catch (sampleError) {
          console.error('加载示例模型数据失败:', sampleError);
        }

        console.log('尝试从存储桶获取模型数据');

        // 如果models表中没有数据，尝试直接从存储桶获取文件
        console.log('尝试从存储桶获取模型文件...');

        // 检查存储桶是否存在
        const { data: buckets, error: bucketsError } = await supabase
          .storage
          .listBuckets();

        if (bucketsError) {
          console.error('获取存储桶列表错误:', bucketsError);
        } else {
          console.log('可用的存储桶:', buckets);

          // 检查是否有名为'models'的存储桶
          const modelsBucket = buckets.find(bucket => bucket.name === 'models');
          if (!modelsBucket) {
            console.log('没有找到名为"models"的存储桶，尝试创建...');
            try {
              const { data, error } = await supabase.storage.createBucket('models', {
                public: true
              });
              if (error) {
                console.error('创建存储桶失败:', error);
              } else {
                console.log('成功创建"models"存储桶:', data);
              }
            } catch (createError) {
              console.error('创建存储桶时出错:', createError);
            }
          } else {
            console.log('找到"models"存储桶:', modelsBucket);
          }
        }

        // 列出存储桶中的文件
        const { data: storageData, error: storageError } = await supabase
          .storage
          .from('models')
          .list();

        if (storageError) {
          console.error('获取存储桶数据错误:', storageError);
          return;
        }

        console.log('存储桶列表响应:', { data: storageData, error: storageError });

        if (storageData && storageData.length > 0) {
          console.log('从存储桶获取到的文件:', storageData);

          // 过滤出3D模型文件（通常是.glb, .gltf, .obj, .fbx等格式）
          const modelFiles = storageData.filter(file => {
            const extension = file.name.split('.').pop()?.toLowerCase();
            return ['glb', 'gltf', 'obj', 'fbx'].includes(extension || '');
          });

          if (modelFiles.length > 0) {
            // 将存储桶中的文件转换为模型数据格式
            const storageModels: Model[] = await Promise.all(modelFiles.map(async (file) => {
              // 获取文件的公共URL
              const { data: { publicUrl } } = supabase
                .storage
                .from('models')
                .getPublicUrl(file.name);

              return {
                id: `storage_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                name: file.name,
                description: `存储桶中的模型: ${file.name}`,
                file_path: publicUrl,
                created_at: file.created_at,
                updated_at: file.updated_at
              };
            }));

            console.log('从存储桶创建的模型数据:', storageModels);
            setModels(storageModels);

            // 如果没有当前选中的模型，选择第一个
            if (!currentModel && !showUploadedModels) {
              setSelectedModel(storageModels[0].id);
              setCurrentModel(storageModels[0]);
            }

            // 将这些模型数据保存到models表中，以便将来使用
            try {
              // 为每个模型创建一个插入记录
              for (const model of storageModels) {
                const { error: insertError } = await supabase
                  .from('models')
                  .insert([{
                    name: model.name,
                    description: model.description,
                    file_path: model.file_path,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }]);

                if (insertError) {
                  console.error(`保存模型 ${model.name} 到表中出错:`, insertError);
                } else {
                  console.log(`已将模型 ${model.name} 保存到models表`);
                }
              }

              // 保存完成后重新获取模型列表
              fetchModels();
            } catch (insertErr) {
              console.error('尝试保存模型数据时出错:', insertErr);
            }
          } else {
            console.log('存储桶中没有找到有效的3D模型文件');
            setModels([]);
          }
        } else {
          console.log('存储桶中没有找到文件');
          setModels([]);
        }
      }
    } catch (error) {
      console.error('获取模型时出错:', error);
    } finally {
      setLoading(false);
    }
  };

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
    console.log('开始拖拽 - 鼠标按下事件触发');
    e.stopPropagation(); // 阻止事件冒泡

    // 防止文本选择
    document.body.style.userSelect = 'none';
    // 添加拖拽时的全局样式
    document.body.style.cursor = 'col-resize';

    // 开始拖拽 - 设置状态会触发useEffect添加事件监听器
    setIsDragging(true);
    console.log('isDragging 设置为 true');

    // 防止默认拖拽行为
    e.preventDefault();
  }, []);

  // 处理拖拽移动
  const handleDragMove = useCallback((e: MouseEvent) => {
    console.log('拖拽移动事件触发', '当前isDragging状态:', isDragging);

    // 如果不在拖拽状态或没有引用到主内容区域，则返回
    if (!isDragging) {
      console.log('未处于拖拽状态，忽略移动事件');
      return;
    }

    if (!mainContentRef.current) {
      console.log('mainContentRef不存在，忽略移动事件');
      return;
    }

    // 获取容器尺寸和鼠标位置
    const containerRect = mainContentRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;

    console.log('鼠标位置:', mouseX, '容器宽度:', containerWidth);

    // 计算新的侧边栏宽度，确保在合理范围内
    let newWidth = containerWidth - mouseX;

    // 设置最小和最大宽度限制
    const minWidth = 180;
    const maxWidth = Math.min(400, containerWidth * 0.5);

    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    console.log('计算的新宽度:', newWidth, '当前宽度:', sidebarWidth);

    // 直接设置宽度
    setSidebarWidth(newWidth);
    console.log('已设置新宽度');
  }, [isDragging, sidebarWidth]);

  // 处理拖拽结束
  const handleDragEnd = useCallback(() => {
    console.log('拖拽结束事件触发', '当前isDragging状态:', isDragging);

    // 恢复样式
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    console.log('已恢复样式');

    // 设置拖拽状态为false - 会触发useEffect移除事件监听器
    setIsDragging(false);
    console.log('isDragging 设置为 false');
  }, [isDragging]);

  // 全局事件处理器，确保在任何情况下都能正确清理
  useEffect(() => {
    // 添加全局鼠标抬起事件处理器，作为安全措施
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        console.log('全局鼠标抬起事件触发，强制结束拖拽');
        handleDragEnd();
      }
    };

    // 添加全局按键事件处理器，按ESC键结束拖拽
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDragging) {
        console.log('ESC键按下，强制结束拖拽');
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
    console.log('isDragging状态变化:', isDragging);

    if (isDragging) {
      console.log('进入拖拽状态，添加事件监听器');
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);

      // 清理函数，组件卸载或依赖项变化时执行
      return () => {
        console.log('清理事件监听器');
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

        console.log('窗口调整:', {
          windowHeight,
          headerHeight,
          contentHeight,
          mainContentWidth: mainContentRef.current.offsetWidth,
          sidebarWidth
        });
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
          >
            <CopyIcon className="w-4 h-4 text-[#ffffffb2]" />
            <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal">
              复制图片
            </span>
          </Button>

          <Button className="h-8 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#2268eb] rounded-lg hover:bg-[#2268eb]/90">
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
          <CardContent className="p-0 space-y-4 w-full h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[#3a3a3a] scrollbar-track-transparent">
            {/* Model Selection Section */}
            <div className="flex flex-col items-start gap-2 relative self-stretch w-full">
              <div className="inline-flex items-center gap-1 relative">
                <BoxIcon className="w-4 h-4 text-[#ffffffb2]" />
                <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal">
                  模型
                </span>
              </div>

              {/* 模型卡片列表 */}
              <div className="max-h-[30vh] overflow-y-auto pr-1 mb-2 scrollbar-thin scrollbar-thumb-[#3a3a3a] scrollbar-track-transparent">
                {loading ? (
                  <div className="p-4 text-center text-[#ffffff80] text-[14px]">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span>加载模型中...</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 根据状态显示上传的模型或内置模型 */}
                    {(showUploadedModels ? uploadedModels : models).map((model) => (
                      <div
                        key={model.id}
                        className={`flex items-center justify-between p-2 my-1 rounded-lg cursor-pointer transition-colors duration-150 ${selectedModel === model.id ? 'bg-[#2268eb] text-white' : 'bg-[#2a2a2a] text-[#ffffffe6] hover:bg-[#3a3a3a]'}`}
                        onClick={() => {
                          console.log('选择模型:', model);
                          // 先清除当前模型，然后设置新模型，确保状态更新
                          setCurrentModel(null);
                          setSelectedModel('');

                          // 使用setTimeout确保状态更新后再设置新模型
                          setTimeout(() => {
                            setSelectedModel(model.id);
                            setCurrentModel(model);
                            console.log('当前选中的模型:', model);
                          }, 50);
                        }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-6 h-6 flex-shrink-0 bg-[#ffffff1a] rounded-md flex items-center justify-center">
                            <BoxIcon className="w-4 h-4" />
                          </div>
                          <span className="text-[14px] font-[500] truncate">{model.name}</span>
                        </div>

                        {/* 删除按钮，只对上传的模型显示 */}
                        {showUploadedModels && (
                          <button
                            className={`p-1 rounded-md ${selectedModel === model.id ? 'hover:bg-[#4b83f0] text-white' : 'hover:bg-[#ffffff1a] text-[#ffffff80]'}`}
                            onClick={(e) => {
                              e.stopPropagation(); // 阻止事件冒泡到父元素
                              deleteUploadedModel(model.id);
                            }}
                            title="删除模型"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18"></path>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}

                    {/* 当没有模型时显示提示 */}
                    {(showUploadedModels ? uploadedModels : models).length === 0 && (
                      <div className="p-4 text-center text-[#ffffff80] text-[14px]">
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
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  className="h-8 flex-1 min-w-[80px] flex items-center justify-center gap-1 px-2 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon className="w-4 h-4 text-[#ffffffb2]" />
                  <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal truncate">
                    上传模型
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  className="h-8 flex-1 min-w-[80px] flex items-center justify-center gap-1 px-2 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
                  onClick={fetchModels}
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#ffffffb2]">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                    <path d="M16 21h5v-5"></path>
                  </svg>
                  <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal truncate">
                    刷新模型
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  className="h-8 flex-1 min-w-[80px] flex items-center justify-center gap-1 px-2 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
                  onClick={async () => {
                    try {
                      // 获取存储桶中的文件
                      const { data: storageData, error: storageError } = await supabase
                        .storage
                        .from('models')
                        .list();

                      if (storageError) {
                        console.error('获取存储桶数据错误:', storageError);
                        alert('获取存储桶数据失败');
                        return;
                      }

                      if (!storageData || storageData.length === 0) {
                        alert('存储桶中没有文件');
                        return;
                      }

                      // 过滤出3D模型文件
                      const modelFiles = storageData.filter(file => {
                        const extension = file.name.split('.').pop()?.toLowerCase();
                        return ['glb', 'gltf', 'obj', 'fbx'].includes(extension || '');
                      });

                      if (modelFiles.length === 0) {
                        alert('存储桶中没有3D模型文件');
                        return;
                      }

                      // 获取已有的模型记录
                      const { data: existingModels, error: fetchError } = await supabase
                        .from('models')
                        .select('file_path');

                      if (fetchError) {
                        console.error('获取现有模型数据错误:', fetchError);
                      }

                      // 创建一个已有模型URL的集合，用于快速查找
                      const existingUrls = new Set(existingModels?.map(model => model.file_path) || []);

                      // 计数器
                      let addedCount = 0;
                      let skippedCount = 0;

                      // 为每个模型文件创建记录
                      for (const file of modelFiles) {
                        // 获取文件的公共URL
                        const { data: { publicUrl } } = supabase
                          .storage
                          .from('models')
                          .getPublicUrl(file.name);

                        // 检查是否已存在相同URL的模型
                        if (existingUrls.has(publicUrl)) {
                          console.log(`模型 ${file.name} 已存在，跳过`);
                          skippedCount++;
                          continue;
                        }

                        // 插入新模型记录
                        const { error: insertError } = await supabase
                          .from('models')
                          .insert([{
                            name: file.name,
                            description: `存储桶中的模型: ${file.name}`,
                            file_path: publicUrl,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                          }]);

                        if (insertError) {
                          console.error(`保存模型 ${file.name} 到表中出错:`, insertError);
                        } else {
                          console.log(`已将模型 ${file.name} 保存到models表`);
                          addedCount++;
                        }
                      }

                      // 显示结果
                      alert(`同步完成: 新增 ${addedCount} 个模型，跳过 ${skippedCount} 个已存在的模型`);

                      // 刷新模型列表
                      fetchModels();
                    } catch (error) {
                      console.error('同步模型数据时出错:', error);
                      alert('同步模型数据失败');
                    }
                  }}
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#ffffffb2]">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal truncate">
                    同步模型
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
                    <span className={`text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal truncate ${showUploadedModels ? 'text-[#2268eb]' : ''}`}>
                      上传模型
                    </span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="h-8 flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#ffffff1f] rounded-lg hover:bg-[#ffffff33]"
                    onClick={() => setShowUploadedModels(false)}
                  >
                    <span className={`text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal truncate ${!showUploadedModels ? 'text-[#2268eb]' : ''}`}>
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
                  <span className="text-[#ffffffb2] w-fit mt-[-1.00px] text-[14px] font-[500] leading-normal truncate">
                    清除所有上传模型
                  </span>
                </Button>
              )}
            </div>

            {/* Material Settings Section */}
            <div className="flex flex-col items-start gap-2 relative flex-1 self-stretch w-full grow">
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
              <Tabs defaultValue="standard" className="w-full">
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

                <TabsContent value="standard" className="mt-3 p-0">
                  <div className="flex flex-col items-start gap-3 relative flex-1 self-stretch w-full grow rounded-2xl">
                    {/* Search Input */}
                    <div className="flex items-center gap-1 px-2 py-1.5 relative self-stretch w-full bg-[#00000026] rounded-lg overflow-hidden">
                      <SearchIcon className="w-4 h-4 text-[#ffffff66]" />
                      <Input
                        className="border-0 bg-transparent text-[#ffffff66] text-[14px] font-[500] leading-normal p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="搜索"
                      />
                    </div>

                    {/* Material Grid */}
                    <div className="flex flex-wrap w-full items-start gap-[8px] relative flex-1 max-h-[30vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#3a3a3a] scrollbar-track-transparent">
                      {materials.map((material) => (
                        <div
                          key={material.id}
                          className={`flex w-[calc(33.33%-6px)] h-[60px] items-center gap-1 p-2.5 relative bg-[#ffffff0d] rounded-lg ${material.id === selectedMaterialId ? "border border-solid border-[#2268eb]" : ""}`}
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
                  <div className="space-y-2">
                    <label className="text-[#ffffffb2] text-[14px] font-[500] leading-normal">颜色</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="w-8 h-8 bg-[#00000026] rounded-lg border-0 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
                      />
                      <Input
                        value={customColor.toUpperCase()}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="flex-1 h-8 px-2 py-1.5 bg-[#00000026] text-[#ffffffe6] text-[14px] font-[500] leading-normal border-0 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 uppercase"
                      />
                    </div>
                  </div>

                  {/* Roughness Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
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
                  <div className="space-y-2">
                    <div className="flex justify-between">
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
    </main>
  );
};