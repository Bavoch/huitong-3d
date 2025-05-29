import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Model } from '../lib/localStorage';
import { saveFileToMemory } from '../utils/fileStorage';
import { ensureThumbnailsBucketExists } from '../utils/storageBuckets';

interface ThumbnailGeneratorProps {
  model: Model;
  onThumbnailGenerated?: (thumbnailUrl: string) => void;
}

/**
 * 缩略图生成组件
 * 这个组件在后台渲染模型并生成缩略图，不会显示在UI中
 */
const ThumbnailGenerator: React.FC<ThumbnailGeneratorProps> = ({ model, onThumbnailGenerated }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 保存缩略图到本地存储
  const uploadThumbnail = async (dataUrl: string, modelName: string): Promise<string | null> => {
    try {
      // 确保thumbnails存储桶存在
      const bucketExists = await ensureThumbnailsBucketExists();
      if (!bucketExists) {
        return null;
      }

      // 从Data URL创建Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // 生成唯一的文件名
      const fileName = `${Date.now()}_${modelName.replace(/\.[^/.]+$/, '')}_thumbnail.png`;

      // 保存到本地存储并返回URL
      const fileUrl = saveFileToMemory(blob);
      return fileUrl;
    } catch (error) {
      console.error('保存缩略图失败:', error);
      return null;
    }
  };

  // 更新模型记录的thumbnail_url字段
  const updateModelThumbnail = async (modelId: string, thumbnailUrl: string): Promise<boolean> => {
    try {
      // 使用本地存储更新模型缩略图
      // 实际的数据存储操作将在Screen组件中完成
      return true;
    } catch (error) {
      console.error('更新模型缩略图失败:', error);
      return false;
    }
  };

  // 生成缩略图
  const generateThumbnail = async () => {
    if (!containerRef.current || !model.file_path) return;

    // 如果模型已经有缩略图，跳过
    if (model.thumbnail_url && !model.thumbnail_url.includes('placehold.co')) {
      return;
    }

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // 创建相机
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(256, 256);
    containerRef.current.appendChild(renderer.domElement);

    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // 创建控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    // 加载模型
    const loader = new GLTFLoader();

    try {
      // 设置加载超时
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('模型加载超时')), 30000);
      });

      // 加载模型
      const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
        loader.load(
          model.file_path,
          (gltf) => resolve(gltf.scene),
          undefined,
          (error) => reject(error)
        );
      });

      // 使用Promise.race来处理超时
      const modelScene = await Promise.race([loadPromise, timeoutPromise]) as THREE.Group;

      // 计算包围盒并居中模型
      const box = new THREE.Box3().setFromObject(modelScene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // 重置模型位置到中心
      modelScene.position.x = -center.x;
      modelScene.position.y = -center.y;
      modelScene.position.z = -center.z;

      // 调整相机位置以适应模型大小
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

      // 更新相机位置
      camera.position.z = cameraZ;
      camera.lookAt(new THREE.Vector3(0, 0, 0));
      camera.updateProjectionMatrix();

      // 添加模型到场景并旋转到合适角度
      scene.add(modelScene);
      modelScene.rotation.y = Math.PI / 4;

      // 渲染场景
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');

      // 上传缩略图
      const thumbnailUrl = await uploadThumbnail(dataUrl, model.name);

      if (thumbnailUrl && onThumbnailGenerated) {
        await updateModelThumbnail(model.id, thumbnailUrl);
        onThumbnailGenerated(thumbnailUrl);
      }
    } catch (error) {
      // 创建一个简单的彩色方块作为缩略图
      const geometry = new THREE.BoxGeometry(1, 1, 1);

      // 生成一个基于模型名称的随机颜色
      const hash = model.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const r = (hash % 200) + 55; // 55-255 范围内的红色值
      const g = ((hash * 2) % 200) + 55; // 55-255 范围内的绿色值
      const b = ((hash * 3) % 200) + 55; // 55-255 范围内的蓝色值

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(r/255, g/255, b/255),
        roughness: 0.5,
        metalness: 0.5
      });

      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);

      // 渲染场景
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');

      // 上传缩略图
      const thumbnailUrl = await uploadThumbnail(dataUrl, model.name);

      if (thumbnailUrl && onThumbnailGenerated) {
        await updateModelThumbnail(model.id, thumbnailUrl);
        onThumbnailGenerated(thumbnailUrl);
      }
    } finally {
      // 清理资源
      if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
    }
  };

  useEffect(() => {
    generateThumbnail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: '256px',
        height: '256px',
        overflow: 'hidden'
      }}
    />
  );
};

export default ThumbnailGenerator;
