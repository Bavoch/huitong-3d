import { useState, useEffect } from "react";
import { getModels } from "../../lib/localStorage";
import { getMaterials } from "../../lib/materialStorage";
import { Card, CardContent } from "../../components/ui/card";

export const AdminDashboard = (): JSX.Element => {
  const [modelCount, setModelCount] = useState(0);
  const [materialCount, setMaterialCount] = useState(0);
  
  useEffect(() => {
    // 获取模型和材质数量
    const models = getModels();
    const materials = getMaterials();
    
    setModelCount(models.length);
    setMaterialCount(materials.length);
  }, []);
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">控制台</h2>
      
      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow transition-shadow">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2">模型总数</h3>
            <p className="text-3xl font-bold text-blue-600">{modelCount}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow transition-shadow">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2">材质总数</h3>
            <p className="text-3xl font-bold text-blue-600">{materialCount}</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-medium text-gray-700 mb-3">系统信息</h3>
        <ul className="space-y-2 text-gray-600">
          <li className="flex justify-between">
            <span>版本</span>
            <span>会通智能色彩云库 v1.0.0</span>
          </li>
          <li className="flex justify-between">
            <span>数据存储</span>
            <span>本地存储 (localStorage)</span>
          </li>
          <li className="flex justify-between">
            <span>最近更新</span>
            <span>{new Date().toLocaleDateString('zh-CN')}</span>
          </li>
        </ul>
      </div>
      
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-medium text-gray-700 mb-3">使用说明</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>在 <strong className="text-gray-800">模型管理</strong> 页面可以上传、删除和查看3D模型</li>
          <li>在 <strong className="text-gray-800">材质管理</strong> 页面可以创建、编辑和删除自定义材质</li>
        </ul>
      </div>
    </div>
  );
};
