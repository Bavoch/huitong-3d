-- 修复模型数据库的SQL脚本
-- 可以直接在Supabase管理界面的SQL编辑器中执行

-- 1. 创建一个临时表来存储每个file_path的最新记录的ID
CREATE TEMP TABLE latest_models AS
SELECT DISTINCT ON (file_path) id, name, file_path
FROM models
ORDER BY file_path, created_at DESC;

-- 2. 删除不在临时表中的记录（删除重复记录）
DELETE FROM models
WHERE id NOT IN (SELECT id FROM latest_models);

-- 3. 为所有没有缩略图的模型更新缩略图URL
-- 使用一个通用的占位图URL
UPDATE models
SET thumbnail_url = 'https://placehold.co/256x256/3498db/FFFFFF?text=3D%20Model'
WHERE thumbnail_url IS NULL;

-- 4. 查看结果
SELECT id, name, file_path, thumbnail_url
FROM models
ORDER BY name;

-- 删除临时表
DROP TABLE latest_models;
