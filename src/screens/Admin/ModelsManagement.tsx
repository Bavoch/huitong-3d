import { useState, useEffect, useRef } from "react";
import { getModels, saveModel, deleteModel, Model } from "../../lib/localStorage";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent } from "../../components/ui/card";
import { UploadIcon, TrashIcon, SearchIcon } from "lucide-react";
import { validateModelFile, processModelFile, generateModelThumbnail } from "../../utils/modelProcessor";

export const ModelsManagement = (): JSX.Element => {
  const [models, setModels] = useState<Model[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 初始化时获取模型列表
  useEffect(() => {
    fetchModels();
  }, []);
  
  // 获取模型列表
  const fetchModels = () => {
    const modelsList = getModels();
    setModels(modelsList);
  };
  
  // 过滤模型列表
  const filteredModels = models.filter(model => 
    model.name.toLowerCase().includes(search.toLowerCase()) ||
    (model.description && model.description.toLowerCase().includes(search.toLowerCase()))
  );
  
  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileName = file.name;

    setLoading(true);

    try {
      // 验证文件
      const isValid = await validateModelFile(file);
      if (!isValid) {
        alert('请上传有效的3D模型文件（.glb, .gltf, .obj, .fbx）');
        setLoading(false);
        return;
      }

      // 处理模型文件
      const { processedFile, metadata } = await processModelFile(file);

      // 创建文件URL用于本地预览
      const fileURL = URL.createObjectURL(processedFile);

      // 生成缩略图
      const thumbnailDataUrl = await generateModelThumbnail(fileURL);

      // 创建新的模型对象
      const currentTime = new Date().toISOString();
      const newModel: Model = {
        id: `model-${Date.now()}`,
        name: fileName,
        file_path: fileURL,
        description: `上传的模型: ${fileName} (${(metadata.processedSize / (1024 * 1024)).toFixed(2)}MB)`,
        thumbnail_url: thumbnailDataUrl,
        created_at: currentTime,
        updated_at: currentTime
      };

      // 保存模型
      saveModel(newModel);
      fetchModels();
      
      alert('模型上传成功!');
    } catch (error) {
      console.error('上传模型时出错:', error);
      alert('上传模型时出错，请重试');
    } finally {
      setLoading(false);
      // 重置文件输入，以便再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // 删除模型
  const handleDeleteModel = (modelId: string) => {
    if (window.confirm('确定要删除此模型吗？')) {
      deleteModel(modelId);
      fetchModels();
    }
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">模型管理</h2>
      
      <div className="flex justify-between items-center">
        {/* 搜索框 */}
        <div className="relative w-64">
          <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索模型..."
            className="pl-10 border-gray-200 text-gray-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {/* 上传按钮 */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".glb,.gltf,.obj,.fbx"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-500 hover:bg-blue-600 text-white"
            disabled={loading}
          >
            <UploadIcon className="h-4 w-4 mr-2" />
            上传模型
          </Button>
        </div>
      </div>
      
      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-500">处理模型中，请稍候...</p>
        </div>
      )}
      
      {!loading && filteredModels.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            {search ? '没有找到匹配的模型' : '暂无上传的模型，请点击上传模型按钮添加'}
          </p>
        </div>
      )}
      
      {/* 模型列表 */}
      <div className="grid grid-cols-3 gap-4">
        {filteredModels.map(model => (
          <Card key={model.id} className="bg-white border-gray-200 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-0">
              <div className="aspect-square overflow-hidden bg-gray-50 flex items-center justify-center border-b border-gray-200">
                {model.thumbnail_url ? (
                  <img 
                    src={model.thumbnail_url} 
                    alt={model.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-gray-400">无预览图</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-800 truncate mb-1" title={model.name}>
                  {model.name}
                </h3>
                {model.description && (
                  <p className="text-gray-500 text-sm line-clamp-2" title={model.description}>
                    {model.description}
                  </p>
                )}
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-gray-400">
                    上传时间: {new Date(model.created_at || '').toLocaleDateString()}
                  </span>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8 px-2 bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                    onClick={() => handleDeleteModel(model.id)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
