import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, PresentationControls, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import { type Model } from '../lib/supabase';

// 改进的加载指示器组件，显示进度和阶段
function LoadingIndicator({ progress = 0, stage = '准备中' }: { progress?: number; stage?: string }) {
  return (
    <group>
      {/* 加载中文字和进度条 */}
      <Html position={[0, 0, 0]} center>
        <div className="bg-black/70 text-white px-6 py-4 rounded-md text-center">
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
              <div
                className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white font-medium text-lg">
                {stage} ({progress.toFixed(0)}%)
              </span>
            </div>
          </div>
          <div className="text-gray-300 mt-2">请稍候</div>
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
  const [loadAttempts, setLoadAttempts] = useState<number>(0);
  const previousPathRef = useRef<string>('');

  // 尝试加载模型
  useEffect(() => {
    console.log('ModelLoader - 尝试加载模型:', modelPath);

    // 检查模型路径是否变化
    const isPathChanged = previousPathRef.current !== modelPath;
    previousPathRef.current = modelPath;

    // 如果路径变化，重置加载尝试次数
    if (isPathChanged) {
      setLoadAttempts(0);
    }

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
    // 添加加载尝试次数到key中，确保重试时会重新渲染
    setModelKey(`${modelPath}_${Date.now()}_attempt_${loadAttempts}`);

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
  }, [modelPath, loadAttempts]);

  // 添加简单的旋转动画
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;
    }
  });

  // 处理模型加载错误
  const handleModelError = useCallback(() => {
    console.error('模型加载失败:', modelPath);

    // 如果尝试次数小于3，增加尝试次数并重试
    if (loadAttempts < 2) {
      console.log(`自动重试加载模型 (尝试 ${loadAttempts + 1}/3)...`);
      setLoadAttempts(prev => prev + 1);
    } else {
      // 超过最大尝试次数，显示错误
      setError('模型加载失败');
      setUseDefaultModel(true);
    }
  }, [modelPath, loadAttempts]);

  // 手动重试加载
  const handleRetry = useCallback(() => {
    console.log('手动重试加载模型...');
    setError(null);
    setUseDefaultModel(false);
    setLoadAttempts(prev => prev + 1);
  }, []);

  if (useDefaultModel || error) {
    return (
      <group ref={groupRef}>
        <DefaultModel
          customColor={customColor}
          customRoughness={customRoughness}
          customMetallic={customMetallic}
        />
        {error && (
          <Html position={[0, -1.5, 0]} center>
            <div className="bg-black/70 text-white px-4 py-2 rounded-md text-center">
              <div className="text-white text-sm">{error}</div>
              <button
                onClick={handleRetry}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded mt-2 text-xs"
              >
                重试加载
              </button>
            </div>
          </Html>
        )}
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
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [loadStage, setLoadStage] = useState<string>('准备中');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const maxRetries = 2; // 最大重试次数

  // 清理函数 - 用于清理资源
  const cleanupResources = useCallback(() => {
    if (currentModelPath) {
      try {
        // 从缓存中移除模型
        useGLTF.dispose(currentModelPath);
        console.log('已从缓存中移除模型:', currentModelPath);

        // 如果是Blob URL，释放它
        if (currentModelPath.startsWith('blob:')) {
          URL.revokeObjectURL(currentModelPath);
          console.log('已释放Blob URL:', currentModelPath);
        }
      } catch (e) {
        console.warn('清理资源失败:', e);
      }
    }
  }, [currentModelPath]);

  // 重置加载状态
  const resetLoadingState = useCallback(() => {
    setModelScene(null);
    setLoadProgress(0);
    setLoadStage('准备中');
    setIsLoading(false);
  }, []);

  // 重试加载
  const retryLoading = useCallback(() => {
    if (retryCount < maxRetries) {
      console.log(`尝试重新加载模型 (${retryCount + 1}/${maxRetries})...`);
      setRetryCount(prev => prev + 1);
      setLoadError(false);
      resetLoadingState();
      // 延迟一点时间再重试，给浏览器一些时间清理资源
      setTimeout(() => {
        setIsLoading(true);
      }, 500);
    } else {
      console.error('达到最大重试次数，模型加载失败');
      onError();
    }
  }, [retryCount, maxRetries, resetLoadingState, onError]);

  // 使用useEffect来处理模型加载和错误
  useEffect(() => {
    let isMounted = true;
    let loadingTimeout: number | null = null;

    // 如果模型路径发生变化，清除当前模型场景和资源
    if (currentModelPath !== modelPath) {
      console.log('模型路径已变更，清除当前模型场景');

      // 清理之前的资源
      cleanupResources();

      // 重置状态
      resetLoadingState();
      setRetryCount(0);
      setCurrentModelPath(modelPath);
      setIsLoading(true);
    }

    // 如果不在加载状态，不执行加载
    if (!isLoading) return;

    // 设置加载超时
    loadingTimeout = setTimeout(() => {
      if (isMounted && !modelScene && isLoading) {
        console.warn('模型加载超时，尝试重试');
        retryLoading();
      }
    }, 15000); // 15秒超时

    const loadModel = async () => {
      console.log('开始加载模型:', modelPath);

      // 创建自定义加载器以跟踪进度
      const createProgressTracker = (url: string) => {
        return new Promise<THREE.Group>((resolve, reject) => {
          // 使用 THREE.js 的加载管理器跟踪加载进度
          const manager = new THREE.LoadingManager();

          manager.onProgress = (url, loaded, total) => {
            if (isMounted) {
              const progress = Math.min(Math.round((loaded / total) * 80), 80); // 下载阶段占80%
              setLoadProgress(progress);
              setLoadStage('下载中');
              console.log(`模型下载进度: ${progress}%`);
            }
          };

          // 创建 GLTFLoader
          const loader = new THREE.FileLoader(manager);

          // 添加超时处理
          const timeoutId = setTimeout(() => {
            reject(new Error('加载超时'));
          }, 10000); // 10秒超时

          // 开始加载
          loader.load(
            url,
            (data) => {
              // 清除超时
              clearTimeout(timeoutId);

              // 文件已下载，现在使用 useGLTF 加载模型
              if (isMounted) {
                setLoadProgress(85);
                setLoadStage('解析中');

                try {
                  // 使用 useGLTF 加载模型
                  useGLTF.preload(url);
                  const gltf = useGLTF(url);

                  if (isMounted) {
                    setLoadProgress(95);
                    setLoadStage('处理中');
                    resolve(gltf.scene);
                  }
                } catch (error) {
                  reject(error);
                }
              }
            },
            // 进度回调
            (xhr) => {
              if (xhr.lengthComputable && isMounted) {
                const progress = Math.min(Math.round((xhr.loaded / xhr.total) * 80), 80);
                setLoadProgress(progress);
              }
            },
            // 错误回调
            (error) => {
              clearTimeout(timeoutId);
              reject(error);
            }
          );
        });
      };

      // 跳过HEAD请求检查，直接尝试加载模型
      try {
        // 检查模型路径是否为GLB格式
        const isGlb = modelPath.toLowerCase().endsWith('.glb');
        console.log('模型格式:', isGlb ? 'GLB' : 'GLTF');

        // 清除之前的缓存
        try {
          useGLTF.dispose(modelPath);
        } catch (e) {
          console.warn('清除缓存失败，可能是首次加载此模型');
        }

        // 使用进度跟踪器加载模型
        let gltfScene;

        // 对于 Blob URL，我们直接使用 useGLTF
        if (modelPath.startsWith('blob:')) {
          setLoadStage('加载本地文件');
          useGLTF.preload(modelPath);
          const gltf = await useGLTF(modelPath);
          gltfScene = gltf.scene;
          setLoadProgress(90);
        } else {
          // 对于远程 URL，使用进度跟踪器
          gltfScene = await createProgressTracker(modelPath);
        }

        if (!isMounted) return;

        if (gltfScene) {
          console.log('模型场景加载成功，开始处理');
          setLoadStage('应用材质');
          setLoadProgress(95);

          // 克隆模型场景，以便我们可以修改它
          const scene = gltfScene.clone();

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

          setLoadStage('优化模型');
          setLoadProgress(98);

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
          setLoadProgress(100);
          setLoadStage('完成');
          setModelScene(scene);
          setIsLoading(false); // 加载完成
        } else {
          console.error('模型加载失败: 无效的场景');
          throw new Error('模型加载失败: 无效的场景');
        }
      } catch (error) {
        console.error('加载模型失败:', error);
        if (isMounted) {
          if (retryCount < maxRetries) {
            console.log(`加载失败，自动重试 (${retryCount + 1}/${maxRetries})...`);
            retryLoading();
          } else {
            setLoadError(true);
            setIsLoading(false);
            onError(); // 通知父组件发生错误
          }
        }
      }
    };

    loadModel();

    return () => {
      isMounted = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [modelPath, customColor, customRoughness, customMetallic, onError, currentModelPath, isLoading, retryCount, maxRetries, modelScene, cleanupResources, resetLoadingState, retryLoading]);

  // 处理加载错误
  if (loadError) {
    return (
      <Html position={[0, 0, 0]} center>
        <div className="bg-black/70 text-white px-6 py-4 rounded-md text-center">
          <div className="text-white font-medium text-lg">模型加载失败</div>
          <div className="text-gray-300 mt-2">
            {retryCount >= maxRetries ? (
              <span>已尝试多次加载，请选择其他模型</span>
            ) : (
              <button
                onClick={retryLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded mt-2 text-sm"
              >
                重试加载
              </button>
            )}
          </div>
        </div>
      </Html>
    );
  }

  return modelScene ? (
    <primitive object={modelScene} />
  ) : (
    <LoadingIndicator progress={loadProgress} stage={loadStage} />
  );
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
  const [modelValid, setModelValid] = useState<boolean>(true);
  const [modelPath, setModelPath] = useState<string>('');
  const previousModelIdRef = useRef<string>('');

  // 验证和处理模型路径
  useEffect(() => {
    if (selectedModel) {
      console.log('ModelViewer - 当前模型详情:');
      console.log('ID:', selectedModel.id);
      console.log('名称:', selectedModel.name);
      console.log('文件路径:', selectedModel.file_path);

      // 检查模型是否变化
      const modelChanged = previousModelIdRef.current !== selectedModel.id;
      previousModelIdRef.current = selectedModel.id;

      // 验证文件路径
      try {
        const url = new URL(selectedModel.file_path);
        console.log('文件URL有效:', url.toString());

        // 检查文件扩展名
        const fileExtension = url.pathname.split('.').pop()?.toLowerCase();
        console.log('文件扩展名:', fileExtension);

        // 检查是否为支持的格式
        const isValidFormat = ['glb', 'gltf'].includes(fileExtension || '');
        setModelValid(isValidFormat);

        if (isValidFormat) {
          // 设置模型路径
          setModelPath(selectedModel.file_path);

          // 只有在模型变化时才生成新的key
          if (modelChanged) {
            // 生成新的key，强制重新渲染
            // 添加随机延迟，避免快速切换时的冲突
            setTimeout(() => {
              setModelViewKey(`model_${selectedModel.id}_${Date.now()}`);
            }, 50);
          }
        } else {
          console.error('不支持的文件格式:', fileExtension);
          setModelValid(false);
        }
      } catch (e) {
        console.error('文件路径无效:', selectedModel.file_path, e);
        setModelValid(false);
      }
    } else {
      console.log('ModelViewer - 没有选中的模型');
      setModelPath('');
      setModelValid(true);
    }
  }, [selectedModel]);

  // 处理模型加载错误
  const handleModelError = useCallback(() => {
    console.error('模型加载失败，可能需要检查模型文件');
  }, []);

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <SceneLighting />
        <Suspense fallback={<LoadingIndicator progress={10} stage="初始化中" />}>
          {selectedModel && modelValid && modelPath ? (
            <ModelLoader
              key={`loader_${modelViewKey}`} // 使用动态key确保正确重新渲染
              modelPath={modelPath}
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
            minDistance={2}
            maxDistance={10}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ModelViewer;
