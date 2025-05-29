/**
 * 材质本地存储管理工具
 */

// 材质数据类型定义
export type Material = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  roughness: number;
  metallic: number;
  created_at: string;
  updated_at: string;
};

// 本地存储键名
const MATERIALS_STORAGE_KEY = 'huitong3d_materials';

/**
 * 保存材质数据到本地存储
 * @param materials 材质数据数组
 */
export const saveMaterials = (materials: Material[]): void => {
  localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(materials));
};

/**
 * 从本地存储获取材质数据
 * @returns 材质数据数组
 */
export const getMaterials = (): Material[] => {
  const materialsJson = localStorage.getItem(MATERIALS_STORAGE_KEY);
  if (!materialsJson) return [];
  
  try {
    return JSON.parse(materialsJson) as Material[];
  } catch (error) {
    console.error('解析本地存储的材质数据失败:', error);
    return [];
  }
};

/**
 * 添加或更新单个材质
 * @param material 材质数据
 */
export const saveMaterial = (material: Material): void => {
  const materials = getMaterials();
  const existingIndex = materials.findIndex(m => m.id === material.id);
  
  if (existingIndex >= 0) {
    materials[existingIndex] = material;
  } else {
    materials.push(material);
  }
  
  saveMaterials(materials);
};

/**
 * 删除单个材质
 * @param materialId 材质ID
 * @returns 是否成功删除
 */
export const deleteMaterial = (materialId: string): boolean => {
  const materials = getMaterials();
  const initialLength = materials.length;
  const filteredMaterials = materials.filter(material => material.id !== materialId);
  
  if (filteredMaterials.length !== initialLength) {
    saveMaterials(filteredMaterials);
    return true;
  }
  
  return false;
};
