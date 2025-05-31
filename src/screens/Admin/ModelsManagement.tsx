import { useState, useEffect, useRef } from "react";
import { getModels, saveModel, deleteModel, Model } from "../../lib/localStorage";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { UploadIcon, TrashIcon, SearchIcon } from "lucide-react";
import { validateModelFile, processModelFile, generateModelThumbnail } from "../../utils/modelProcessor";
import { readFileAsDataURL } from "../../utils/fileUtils";

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
        alert('请上传有效的3D模型文件（.glb, .gltf, .obj, .fbx）');
        setLoading(false);
        return;
      }

      // 处理模型文件
      const { processedFile, metadata } = await processModelFile(file);

      // 将处理后的文件转换为Data URL进行持久化存储
      const fileDataURL = await readFileAsDataURL(processedFile);

      // 生成缩略图 (仍然可以使用原始的processedFile或其Blob URL进行thumbnail生成，因为这只是临时的)
      // 为了保持一致性，如果generateModelThumbnail接受Data URL更好，但当前它接受URL字符串
      // 我们需要一个临时的Blob URL来生成缩略图，或者修改generateModelThumbnail
      // 暂时，我们先用转换后的Data URL尝试，如果不行再调整
      // 注意：如果模型文件很大，fileDataURL也会很大，可能影响缩略图生成性能
      const thumbnailDataUrl = await generateModelThumbnail(fileDataURL); // 尝试使用Data URL

      // 如果缩略图生成失败，可以给一个默认的或者null
      const finalThumbnailUrl = thumbnailDataUrl || ''; // 或者一个默认占位图的URL

      // 创建新的模型对象
      const currentTime = new Date().toISOString();
      const newModel: Model = {
        id: `model-${Date.now()}`,
        name: fileName,
        file_path: fileDataURL,
        description: `上传的模型: ${fileName} (${(metadata.processedSize / (1024 * 1024)).toFixed(2)}MB)`,
        thumbnail_url: finalThumbnailUrl,
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
      
      {/* 模型表格 */}
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
                    {model.description || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {new Date(model.created_at || '').toLocaleString()}
                  </div>
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
