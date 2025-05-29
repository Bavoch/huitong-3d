/**
 * 本地存储管理工具
 * 用于替代之前的Supabase存储
 */

// 模型数据类型定义
export type Model = {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  thumbnail_url?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

// 本地存储键名
const MODELS_STORAGE_KEY = 'huitong3d_models';

/**
 * 保存模型数据到本地存储
 * @param models 模型数据数组
 */
export const saveModels = (models: Model[]): void => {
  localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));
};

/**
 * 从本地存储获取模型数据
 * @returns 模型数据数组
 */
export const getModels = (): Model[] => {
  const modelsJson = localStorage.getItem(MODELS_STORAGE_KEY);
  if (!modelsJson) return [];
  
  try {
    return JSON.parse(modelsJson) as Model[];
  } catch (error) {
    console.error('解析本地存储的模型数据失败:', error);
    return [];
  }
};

/**
 * 添加或更新单个模型
 * @param model 模型数据
 */
export const saveModel = (model: Model): void => {
  const models = getModels();
  const existingIndex = models.findIndex(m => m.id === model.id);
  
  if (existingIndex >= 0) {
    models[existingIndex] = model;
  } else {
    models.push(model);
  }
  
  saveModels(models);
};

/**
 * 删除单个模型
 * @param modelId 模型ID
 * @returns 是否成功删除
 */
export const deleteModel = (modelId: string): boolean => {
  const models = getModels();
  const initialLength = models.length;
  const filteredModels = models.filter(model => model.id !== modelId);
  
  if (filteredModels.length !== initialLength) {
    saveModels(filteredModels);
    return true;
  }
  
  return false;
};

/**
 * 更新模型缩略图
 * @param modelId 模型ID
 * @param thumbnailUrl 缩略图URL
 * @returns 是否成功更新
 */
export const updateModelThumbnail = (modelId: string, thumbnailUrl: string): boolean => {
  const models = getModels();
  const model = models.find(m => m.id === modelId);
  
  if (model) {
    model.thumbnail_url = thumbnailUrl;
    model.updated_at = new Date().toISOString();
    saveModels(models);
    return true;
  }
  
  return false;
};
