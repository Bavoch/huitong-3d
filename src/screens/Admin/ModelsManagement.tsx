import { useState, useEffect, useRef } from "react";
import { toast } from '../../components/ui/toast';
import { getModels, saveModel, deleteModel, Model } from "../../lib/localStorage";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { UploadIcon, TrashIcon, SearchIcon } from "lucide-react";
import { validateModelFile, processModelFile, generateModelThumbnail } from "../../utils/modelProcessor";

export const ModelsManagement = (): JSX.Element => {
  const [models, setModels] = useState<Model[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 初始化时获取模型列表
  useEffect(() => {
    console.log('ModelsManagement: useEffect triggered, calling fetchModels.');
    fetchModels();
  }, []);
  
  // 获取模型列表
  const fetchModels = () => {
    console.log('ModelsManagement: fetchModels called.');
    const modelsList = getModels();
    console.log('ModelsManagement: Models from localStorage:', modelsList);
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
        toast.error('请上传有效的3D模型文件（.glb, .gltf, .obj, .fbx）');
        setLoading(false);
        return;
      }

      // 处理模型文件
      const { processedFile, metadata } = await processModelFile(file);

      // 生成缩略图
      const blobUrl = URL.createObjectURL(processedFile);
      const thumbnailDataUrl = await generateModelThumbnail(blobUrl);
      URL.revokeObjectURL(blobUrl); // 释放临时URL
      
      // 如果缩略图生成失败，可以给一个默认的或者null
      const finalThumbnailUrl = thumbnailDataUrl || ''; // 或者一个默认占位图的URL

      // 上传到服务器
      const formData = new FormData();
      formData.append('modelFile', processedFile, fileName);
      
      // 服务器URL - 根据实际部署环境调整
      const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? `http://${window.location.hostname}:9000/api/upload-model`
        : '/api/upload-model';
      
      const response = await fetch(serverUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`服务器响应错误: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '上传失败');
      }
      
      // 创建新的模型对象，现在使用服务器返回的文件路径
      const currentTime = new Date().toISOString();
      const newModel: Model = {
        id: `model-${Date.now()}`,
        name: fileName,
        // 使用服务器返回的文件路径，而不是Base64数据
        file_path: result.filePath,
        description: `上传的模型: ${fileName} (${(metadata.processedSize / (1024 * 1024)).toFixed(2)}MB)`,
        thumbnail_url: finalThumbnailUrl,
        created_at: currentTime,
        updated_at: currentTime
      };

      // 保存模型元数据到localStorage
      saveModel(newModel);
      fetchModels();
      
      toast.success('模型上传成功!');
    } catch (error) {
      console.error('上传模型时出错:', error);
      toast.error(`上传模型时出错: ${error instanceof Error ? error.message : '请重试'}`);
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
        <div className="relative w-64">
          <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索模型..."
            className="pl-10 border-gray-200 text-gray-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
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
      
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                缩略图
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                名称
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                描述
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                上传时间
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredModels.map((model) => (
              <tr key={model.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                    {model.thumbnail_url ? (
                      <img 
                        src={model.thumbnail_url} 
                        alt={model.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-gray-400 text-xs">无预览</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{model.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500 max-w-xs truncate" title={model.description || ''}>
                    {model.description || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {new Date(model.created_at || '').toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleDeleteModel(model.id)}
                    className="text-red-600 hover:text-red-900 mr-4"
                    title="删除"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
