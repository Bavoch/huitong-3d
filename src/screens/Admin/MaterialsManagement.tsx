import { useState, useEffect } from "react";
import { getMaterials, saveMaterial, deleteMaterial, Material } from "../../lib/materialStorage";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent } from "../../components/ui/card";
import { PlusIcon, TrashIcon, SearchIcon, EditIcon, SaveIcon, XIcon } from "lucide-react";
import { MaterialThumbnail } from "../../components/MaterialThumbnail";

export const MaterialsManagement = (): JSX.Element => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  
  // 编辑模式相关状态
  const [isCreating, setIsCreating] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  
  // 表单状态
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("#FFFFFF");
  const [formRoughness, setFormRoughness] = useState(0.5);
  const [formMetallic, setFormMetallic] = useState(0);
  
  // 初始化时获取材质列表
  useEffect(() => {
    fetchMaterials();
  }, []);
  
  // 获取材质列表
  const fetchMaterials = () => {
    const materialsList = getMaterials();
    setMaterials(materialsList);
  };
  
  // 过滤材质列表
  const filteredMaterials = materials.filter(material => 
    material.name.toLowerCase().includes(search.toLowerCase()) ||
    (material.description && material.description.toLowerCase().includes(search.toLowerCase()))
  );
  
  // 开始创建新材质
  const startCreating = () => {
    setFormName("");
    setFormDescription("");
    setFormColor("#FFFFFF");
    setFormRoughness(0.5);
    setFormMetallic(0);
    setIsCreating(true);
    setEditingMaterial(null);
  };
  
  // 开始编辑材质
  const startEditing = (material: Material) => {
    setFormName(material.name);
    setFormDescription(material.description || "");
    setFormColor(material.color);
    setFormRoughness(material.roughness);
    setFormMetallic(material.metallic);
    setEditingMaterial(material);
    setIsCreating(false);
  };
  
  // 取消编辑/创建
  const cancelEdit = () => {
    setIsCreating(false);
    setEditingMaterial(null);
  };
  
  // 保存材质
  const saveMaterialData = () => {
    if (!formName.trim()) {
      alert('请输入材质名称');
      return;
    }
    
    const currentTime = new Date().toISOString();
    
    if (isCreating) {
      // 创建新材质
      const newMaterial: Material = {
        id: `material-${Date.now()}`,
        name: formName.trim(),
        description: formDescription.trim() || null,
        color: formColor,
        roughness: formRoughness,
        metallic: formMetallic,
        created_at: currentTime,
        updated_at: currentTime
      };
      
      saveMaterial(newMaterial);
      alert('材质创建成功!');
    } else if (editingMaterial) {
      // 更新现有材质
      const updatedMaterial: Material = {
        ...editingMaterial,
        name: formName.trim(),
        description: formDescription.trim() || null,
        color: formColor,
        roughness: formRoughness,
        metallic: formMetallic,
        updated_at: currentTime
      };
      
      saveMaterial(updatedMaterial);
      alert('材质更新成功!');
    }
    
    // 重置状态并刷新列表
    cancelEdit();
    fetchMaterials();
  };
  
  // 删除材质
  const handleDeleteMaterial = (materialId: string) => {
    if (window.confirm('确定要删除此材质吗？')) {
      deleteMaterial(materialId);
      fetchMaterials();
    }
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">材质管理</h2>
      
      <div className="flex justify-between items-center">
        {/* 搜索框 */}
        <div className="relative w-64">
          <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索材质..."
            className="pl-10 border-gray-200 text-gray-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {/* 新建材质按钮 */}
        <Button 
          onClick={startCreating}
          className="bg-blue-500 hover:bg-blue-600 text-white"
          disabled={isCreating || !!editingMaterial}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          新建材质
        </Button>
      </div>
      
      {/* 编辑/创建表单 */}
      {(isCreating || editingMaterial) && (
        <Card className="bg-white border-gray-200 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-800">
                {isCreating ? '新建材质' : '编辑材质'}
              </h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={cancelEdit}
                className="text-gray-500 hover:text-gray-700"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                {/* 名称 */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">名称</label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="输入材质名称"
                    className="border-gray-200"
                  />
                </div>
                
                {/* 描述 */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">描述 (可选)</label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="输入材质描述"
                    className="border-gray-200"
                  />
                </div>
                
                {/* 颜色选择器 */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">颜色</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
                    />
                    <Input
                      value={formColor.toUpperCase()}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="border-gray-200 uppercase"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* 预览 */}
                <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center mb-2 border border-gray-200">
                  <h4 className="text-sm font-medium text-gray-600 mb-3">材质预览</h4>
                  <MaterialThumbnail 
                    color={formColor}
                    roughness={formRoughness}
                    metallic={formMetallic}
                    size={120}
                    className="border border-gray-200 shadow-lg"
                  />
                </div>
                
                {/* 粗糙度滑块 */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-gray-700">粗糙度</label>
                    <span className="text-sm text-gray-500">{formRoughness.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={formRoughness}
                    onChange={(e) => setFormRoughness(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                
                {/* 金属度滑块 */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-gray-700">金属度</label>
                    <span className="text-sm text-gray-500">{formMetallic.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={formMetallic}
                    onChange={(e) => setFormMetallic(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button 
                onClick={saveMaterialData}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <SaveIcon className="h-4 w-4 mr-2" />
                保存材质
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {!isCreating && !editingMaterial && (
        <div className="space-y-6">
          {filteredMaterials.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {search ? '没有找到匹配的材质' : '暂无添加的材质，请点击新建材质按钮添加'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      颜色
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      名称
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      描述
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      粗糙度
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      金属度
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      更新时间
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMaterials.map((material) => (
                    <tr key={material.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex justify-center">
                          <MaterialThumbnail 
                            color={material.color}
                            roughness={material.roughness}
                            metallic={material.metallic}
                            size={40}
                            className="border border-gray-200 shadow-sm"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{material.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 max-w-xs truncate" title={material.description || ''}>
                          {material.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{material.roughness}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{material.metallic}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(material.updated_at || '').toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => startEditing(material)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                          title="编辑"
                        >
                          <EditIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMaterial(material.id)}
                          className="text-red-600 hover:text-red-900"
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
          )}
        </div>
      )}
    </div>
  );
};
