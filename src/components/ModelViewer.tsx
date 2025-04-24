import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, PresentationControls, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import { type Model } from '../lib/supabase';

// 简单的加载指示器组件
function LoadingIndicator() {
  return (
    <group>
      {/* 加载中文字 */}
      <Html position={[0, 0, 0]} center>
        <div className="bg-black/70 text-white px-6 py-4 rounded-md text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white font-medium text-lg">加载中...</span>
          </div>
          <div className="text-gray-300">请稍候</div>
        </div>
      </Html>
    </group>
  );
}

// 错误显示组件
function ErrorDisplay() {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
}

// 默认模型组件 - 当没有实际模型时显示
function DefaultModel({
  customColor,
  customRoughness,
  customMetallic
}: {
  customColor: string;
  customRoughness: number;
  customMetallic: number;
}) {
  return (
    <group>
      {/* 简单的文字提示 */}
      <Html position={[0, 0, 0]} center>
        <div className="bg-black/70 text-white px-6 py-4 rounded-md text-center">
          <div className="text-white font-medium text-lg">模型加载中...</div>
          <div className="text-gray-300 mt-2">请稍候或选择其他模型</div>
        </div>
      </Html>
    </group>
  );
}

// 模型加载组件
function ModelLoader({
  modelPath,
  customColor,
  customRoughness,
  customMetallic
}: {
  modelPath: string;
  customColor: string;
  customRoughness: number;
  customMetallic: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [useDefaultModel, setUseDefaultModel] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const [modelKey, setModelKey] = useState<string>(''); // 用于强制重新渲染模型

  // 尝试加载模型
  useEffect(() => {
    console.log('尝试加载模型:', modelPath);

    // 如果没有提供模型路径，使用默认模型
    if (!modelPath) {
      console.log('没有提供模型路径，使用默认模型');
      setUseDefaultModel(true);
      return;
    }

    // 重置状态
    setUseDefaultModel(false);
    setError(null);

    // 生成新的模型键，强制重新渲染
    setModelKey(modelPath + '_' + Date.now());

    // 检查模型路径是否为Blob URL（上传的文件）
    if (modelPath.startsWith('blob:')) {
      console.log('加载上传的模型文件:', modelPath);
    } else {
      // 对于非Blob URL，检查路径是否有效
      try {
        const url = new URL(modelPath);
        console.log('模型URL有效:', url.toString());

        // 检查文件扩展名
        const fileExtension = url.pathname.split('.').pop()?.toLowerCase();
        console.log('文件扩展名:', fileExtension);

        if (!['glb', 'gltf'].includes(fileExtension || '')) {
          console.error('不支持的文件格式:', fileExtension);
          setError(`不支持的文件格式: ${fileExtension}`);
          setUseDefaultModel(true);
          return;
        }

        // 不再使用HEAD请求检查URL可访问性，因为某些CDN可能不支持
        // 直接让Three.js的加载器尝试加载模型
        console.log('将尝试直接加载模型:', url.toString());
      } catch (e) {
        console.error('模型路径无效:', modelPath, e);
        setUseDefaultModel(true);
        return;
      }
    }
  }, [modelPath]);

  // 添加简单的旋转动画
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;
    }
  });

  // 处理模型加载错误
  const handleModelError = () => {
    console.error('模型加载失败:', modelPath);
    setError('模型加载失败');
    setUseDefaultModel(true);
  };

  if (useDefaultModel || error) {
    return (
      <group ref={groupRef}>
        <DefaultModel
          customColor={customColor}
          customRoughness={customRoughness}
          customMetallic={customMetallic}
        />
      </group>
    );
  }

  // 渲染模型
  return (
    <group ref={groupRef}>
      <ModelObject
        key={modelKey} // 使用key强制重新渲染
        modelPath={modelPath}
        customColor={customColor}
        customRoughness={customRoughness}
        customMetallic={customMetallic}
        onError={handleModelError}
      />
    </group>
  );
}

// 模型对象组件 - 实际加载和显示3D模型
function ModelObject({
  modelPath,
  customColor,
  customRoughness,
  customMetallic,
  onError
}: {
  modelPath: string;
  customColor: string;
  customRoughness: number;
  customMetallic: number;
  onError: () => void;
}) {
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [currentModelPath, setCurrentModelPath] = useState<string>('');

  // 使用useEffect来处理模型加载和错误
  useEffect(() => {
    let isMounted = true;

    // 如果模型路径发生变化，清除当前模型场景
    if (currentModelPath !== modelPath) {
      console.log('模型路径已变更，清除当前模型场景');
      setModelScene(null);
      setCurrentModelPath(modelPath);

      // 从缓存中移除之前的模型
      if (currentModelPath) {
        try {
          useGLTF.dispose(currentModelPath);
          console.log('已从缓存中移除之前的模型:', currentModelPath);
        } catch (e) {
          console.warn('移除模型缓存失败:', e);
        }
      }
    }

    const loadModel = async () => {
      console.log('开始加载模型:', modelPath);

      // 跳过HEAD请求检查，直接尝试加载模型
      try {
        // 使用useGLTF钩子加载模型
        console.log('调用useGLTF加载模型:', modelPath);

        // 检查模型路径是否为GLB格式
        const isGlb = modelPath.toLowerCase().endsWith('.glb');
        console.log('模型格式:', isGlb ? 'GLB' : 'GLTF');

        // 清除之前的缓存
        try {
          useGLTF.dispose(modelPath);
        } catch (e) {
          console.warn('清除缓存失败，可能是首次加载此模型');
        }

        // 预加载模型，确保它能被正确加载
        // 使用draco压缩的模型需要特殊处理
        useGLTF.preload(modelPath);

        // 加载模型
        const gltf = await useGLTF(modelPath);
        console.log('模型加载结果:', gltf);

        if (!isMounted) return;

        if (gltf && gltf.scene) {
          console.log('模型场景加载成功，开始处理');
          // 克隆模型场景，以便我们可以修改它
          const scene = gltf.scene.clone();

          // 创建材质
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(customColor),
            roughness: customRoughness,
            metalness: customMetallic,
          });

          // 遍历场景中的所有网格，应用材质
          scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              // 保存原始材质以备将来恢复
              if (!child.userData.originalMaterial) {
                child.userData.originalMaterial = child.material;
              }

              // 应用新材质
              child.material = material;
            }
          });

          // 自动调整模型大小和位置
          const box = new THREE.Box3().setFromObject(scene);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim; // 缩放到合适的大小
          scene.scale.set(scale, scale, scale);

          // 将模型置于中心
          const center = box.getCenter(new THREE.Vector3());
          scene.position.x = -center.x * scale;
          scene.position.y = -center.y * scale;
          scene.position.z = -center.z * scale;

          console.log('模型处理完成，设置到场景');
          setModelScene(scene);
        } else {
          console.error('模型加载失败: 无效的场景');
          throw new Error('模型加载失败: 无效的场景');
        }
      } catch (error) {
        console.error('加载模型失败:', error);
        if (isMounted) {
          setLoadError(true);
          onError(); // 通知父组件发生错误
        }
      }
    };

    loadModel();

    return () => {
      isMounted = false;
    };
  }, [modelPath, customColor, customRoughness, customMetallic, onError, currentModelPath]);

  if (loadError) {
    return (
      <Html position={[0, 0, 0]} center>
        <div className="bg-black/70 text-white px-6 py-4 rounded-md text-center">
          <div className="text-white font-medium text-lg">模型加载失败</div>
          <div className="text-gray-300 mt-2">请选择其他模型</div>
        </div>
      </Html>
    );
  }

  return modelScene ? <primitive object={modelScene} /> : <LoadingIndicator />;
}

// 设置场景光照
function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} />
      <directionalLight position={[-10, -10, -5]} intensity={0.8} />
      <hemisphereLight intensity={0.5} groundColor="#444444" />
    </>
  );
}

// 主渲染组件
interface ModelViewerProps {
  selectedModel: Model | null;
  customColor: string;
  customRoughness: number;
  customMetallic: number;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  selectedModel,
  customColor,
  customRoughness,
  customMetallic
}) => {
  console.log('渲染ModelViewer组件，选中的模型:', selectedModel);
  const [modelViewKey, setModelViewKey] = useState<string>('');

  // 添加更多调试信息
  useEffect(() => {
    if (selectedModel) {
      console.log('ModelViewer - 当前模型详情:');
      console.log('ID:', selectedModel.id);
      console.log('名称:', selectedModel.name);
      console.log('文件路径:', selectedModel.file_path);

      // 验证文件路径
      try {
        const url = new URL(selectedModel.file_path);
        console.log('文件URL有效:', url.toString());
        console.log('文件扩展名:', url.pathname.split('.').pop()?.toLowerCase());

        // 生成新的key，强制重新渲染
        setModelViewKey(`model_${selectedModel.id}_${Date.now()}`);
      } catch (e) {
        console.error('文件路径无效:', selectedModel.file_path, e);
      }
    } else {
      console.log('ModelViewer - 没有选中的模型');
    }
  }, [selectedModel]);

  return (
    <div className="w-full h-full">
      <Canvas
        key={`canvas_${modelViewKey}`} // 使用key强制重新创建Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <SceneLighting />
        <Suspense fallback={<LoadingIndicator />}>
          {selectedModel ? (
            <ModelLoader
              key={`loader_${selectedModel.id}`} // 使用模型ID作为key
              modelPath={selectedModel.file_path}
              customColor={customColor}
              customRoughness={customRoughness}
              customMetallic={customMetallic}
            />
          ) : (
            <DefaultModel
              customColor={customColor}
              customRoughness={customRoughness}
              customMetallic={customMetallic}
            />
          )}
          <Environment preset="city" />
          <OrbitControls
            enableZoom={true}
            enablePan={true}
            enableDamping={false}
            dampingFactor={0}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ModelViewer;
