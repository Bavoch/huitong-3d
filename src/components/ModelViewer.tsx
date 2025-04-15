import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, PresentationControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { type Model } from '../lib/supabase';

// 简单的加载指示器组件
function LoadingIndicator() {
  const [rotation, setRotation] = useState(0);
  
  // 创建旋转动画
  useFrame(() => {
    setRotation(prev => prev + 0.05);
  });

  return (
    <group>
      {/* 加载中文字 */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[3, 0.5]} />
        <meshBasicMaterial transparent opacity={0} />
        <Html center position={[0, 0, 0]}>
          <div className="bg-white/80 px-4 py-2 rounded-md shadow-md">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-800 font-medium">加载中...</span>
            </div>
          </div>
        </Html>
      </mesh>
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
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(customColor),
    roughness: customRoughness,
    metalness: customMetallic,
  });
  
  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={material} attach="material" />
      </mesh>
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
    
    // 检查模型路径是否为Blob URL（上传的文件）
    if (modelPath.startsWith('blob:')) {
      console.log('加载上传的模型文件:', modelPath);
    } else {
      // 对于非Blob URL，检查路径是否有效
      try {
        new URL(modelPath);
      } catch (e) {
        console.error('模型路径无效:', modelPath);
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
  
  // 使用useEffect来处理模型加载和错误
  useEffect(() => {
    let isMounted = true;
    
    const loadModel = async () => {
      try {
        // 使用useGLTF钩子加载模型
        const gltf = await useGLTF(modelPath);
        
        if (!isMounted) return;
        
        if (gltf && gltf.scene) {
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
          
          setModelScene(scene);
        } else {
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
  }, [modelPath, customColor, customRoughness, customMetallic, onError]);
  
  if (loadError) {
    return null;
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
  
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <SceneLighting />
        <Suspense fallback={<LoadingIndicator />}>
          <ModelLoader
            modelPath={selectedModel?.file_path || ''}
            customColor={customColor}
            customRoughness={customRoughness}
            customMetallic={customMetallic}
          />
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
