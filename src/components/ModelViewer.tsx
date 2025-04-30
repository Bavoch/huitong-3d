import React, { useRef, useEffect, useState, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Environment } from '@react-three/drei';
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



// 默认模型组件 - 当没有实际模型时显示
function DefaultModel() {
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
  customMetallic,
  autoRotate
}: {
  modelPath: string;
  customColor: string;
  customRoughness: number;
  customMetallic: number;
  autoRotate: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [useDefaultModel, setUseDefaultModel] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const [modelKey, setModelKey] = useState<string>(''); // 用于强制重新渲染模型
  const [loadAttempts, setLoadAttempts] = useState<number>(0);
  const previousPathRef = useRef<string>('');

  // 尝试加载模型
  useEffect(() => {
    // 检查模型路径是否变化
    const isPathChanged = previousPathRef.current !== modelPath;
    previousPathRef.current = modelPath;

    // 如果路径变化，重置加载尝试次数
    if (isPathChanged) {
      setLoadAttempts(0);
    }

    // 如果没有提供模型路径，使用默认模型
    if (!modelPath) {
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
    if (!modelPath.startsWith('blob:')) {
      // 对于非Blob URL，检查路径是否有效
      try {
        const url = new URL(modelPath);

        // 检查文件扩展名
        const fileExtension = url.pathname.split('.').pop()?.toLowerCase();

        if (!['glb', 'gltf'].includes(fileExtension || '')) {
          console.error('不支持的文件格式:', fileExtension);
          setError(`不支持的文件格式: ${fileExtension}`);
          setUseDefaultModel(true);
          return;
        }
      } catch (e) {
        console.error('模型路径无效:', modelPath);
        setUseDefaultModel(true);
        return;
      }
    }
  }, [modelPath, loadAttempts]);

  // 添加简单的旋转动画，根据autoRotate状态决定是否旋转
  useFrame(() => {
    if (groupRef.current && autoRotate) {
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
        <DefaultModel />
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
        // 如果是Blob URL，释放它
        if (currentModelPath.startsWith('blob:')) {
          URL.revokeObjectURL(currentModelPath);
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
    let loadingTimeout: ReturnType<typeof setTimeout> | null = null;

    // 如果模型路径发生变化，清除当前模型场景和资源
    if (currentModelPath !== modelPath) {
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

      // 创建自定义加载器以跟踪进度
      const createProgressTracker = (url: string) => {
        return new Promise<THREE.Group>((resolve, reject) => {
          // 使用 THREE.js 的加载管理器跟踪加载进度
          const manager = new THREE.LoadingManager();

          manager.onProgress = (_, loaded, total) => {
            if (isMounted) {
              const progress = Math.min(Math.round((loaded / total) * 80), 80); // 下载阶段占80%
              setLoadProgress(progress);
              setLoadStage('下载中');
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
            (_) => {
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

        // 使用进度跟踪器加载模型
        let gltfScene;

        // 对于 Blob URL，我们直接使用 useGLTF
        if (modelPath.startsWith('blob:')) {
          setLoadStage('加载本地文件');
          useGLTF.preload(modelPath);
          const gltf = useGLTF(modelPath);
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

  // 添加一个新的useEffect来监听材质属性的变化
  useEffect(() => {
    // 如果模型已加载，更新材质
    if (modelScene) {
      // 创建新的材质
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(customColor),
        roughness: customRoughness,
        metalness: customMetallic,
      });

      // 遍历场景中的所有网格，更新材质
      modelScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // 应用新材质
          child.material = material;
        }
      });
    }
  }, [customColor, customRoughness, customMetallic, modelScene]);

  return modelScene ? (
    <primitive object={modelScene} />
  ) : (
    <LoadingIndicator progress={loadProgress} stage={loadStage} />
  );
}

// 设置场景光照 - 使用简单光照，主要依赖HDR环境贴图
function SceneLighting() {
  return (
    <>
      {/* 基础环境光 - 较低强度，因为HDR环境贴图会提供主要光照 */}
      <ambientLight intensity={0.3} />

      {/* 主光源 - 提供主要方向性光照和阴影 */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.8}
        castShadow
      />
    </>
  );
}

// 主渲染组件
interface ModelViewerProps {
  selectedModel: Model | null;
  customColor: string;
  customRoughness: number;
  customMetallic: number;
  isCapturingMode?: boolean; // 是否处于截图预览模式
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  selectedModel,
  customColor,
  customRoughness,
  customMetallic,
  isCapturingMode = false
}) => {
  const [modelViewKey, setModelViewKey] = useState<string>('');
  const [modelValid, setModelValid] = useState<boolean>(true);
  const [modelPath, setModelPath] = useState<string>('');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const previousModelIdRef = useRef<string>('');
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  // 验证和处理模型路径
  useEffect(() => {
    if (selectedModel) {
      // 检查模型是否变化
      const modelChanged = previousModelIdRef.current !== selectedModel.id;
      previousModelIdRef.current = selectedModel.id;

      // 验证文件路径
      try {
        const url = new URL(selectedModel.file_path);

        // 检查文件扩展名
        const fileExtension = url.pathname.split('.').pop()?.toLowerCase();

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
        console.error('文件路径无效:', selectedModel.file_path);
        setModelValid(false);
      }
    } else {
      setModelPath('');
      setModelValid(true);
    }
  }, [selectedModel]);

  // 捕获当前渲染视图为图片，固定尺寸为1200*1200px
  const captureScreenshot = useCallback((): string => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return '';

    // 创建一个离屏渲染器，尺寸为1200*1200
    const offscreenRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    offscreenRenderer.setSize(1200, 1200);
    offscreenRenderer.setPixelRatio(2); // 设置更高的像素比以获得更清晰的图像

    // 复制当前场景和相机
    const scene = sceneRef.current.clone();
    const camera = cameraRef.current.clone();

    // 调整相机视角以适应新的尺寸比例
    if (camera instanceof THREE.PerspectiveCamera) {
      // 保持视野不变，调整相机位置使模型居中
      camera.aspect = 1; // 1:1 比例
      camera.updateProjectionMatrix();

      // 调整相机位置，确保模型完全可见
      camera.position.z = 5; // 使用与原始相机相同的z位置
    }

    // 添加必要的光源到克隆的场景中，与SceneLighting组件保持一致
    // 基础环境光 - 较低强度，因为我们会添加环境贴图
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);

    // 主光源 - 提供主要方向性光照和阴影
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 10, 5);

    // 添加光源到场景
    scene.add(ambientLight);
    scene.add(mainLight);

    // 注意：在实际应用中，我们应该也克隆环境贴图
    // 但由于这里无法直接访问环境贴图，我们使用增强的光照来补偿
    // 在实际渲染中，用户会看到带有HDR环境贴图的效果

    // 设置透明背景
    offscreenRenderer.setClearColor(0x000000, 0);

    // 渲染场景
    offscreenRenderer.render(scene, camera);

    // 获取图像数据
    const dataURL = offscreenRenderer.domElement.toDataURL('image/png');

    // 清理离屏渲染器
    offscreenRenderer.dispose();

    return dataURL;
  }, [sceneRef, cameraRef]);

  // 将渲染器引用暴露给父组件
  useEffect(() => {
    // 将捕获截图的方法暴露给父组件
    if (window) {
      (window as any).captureModelScreenshot = captureScreenshot;
    }

    return () => {
      // 清理
      if (window && (window as any).captureModelScreenshot) {
        delete (window as any).captureModelScreenshot;
      }
    };
  }, [captureScreenshot]);

  return (
    <div className="w-full h-full relative">
      {/* 截图预览模式下的遮罩和指示器 */}
      {isCapturingMode && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="w-full h-full flex items-center justify-center">
            {/* 中心区域保持透明，周围区域暗化 */}
            <div className="absolute inset-0 bg-black/50"></div>
            <div className="relative w-[80%] h-[80%] max-w-[800px] max-h-[800px] aspect-square">
              {/* 透明区域 */}
              <div className="absolute inset-0 border-2 border-dashed border-white/70 rounded-lg"></div>
              {/* 移除暗化效果 */}
              <div className="absolute inset-0 bg-transparent"></div>
              {/* 尺寸指示 */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                导出尺寸: 1200 × 1200 像素
              </div>
            </div>
          </div>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{
          antialias: true,
          preserveDrawingBuffer: true, // 允许截图
          alpha: true // 透明背景
        }}
        dpr={[1, 2]}
        onCreated={({ gl, scene, camera }) => {
          // 保存渲染器、场景和相机引用
          rendererRef.current = gl;
          sceneRef.current = scene;
          cameraRef.current = camera;
        }}
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
              autoRotate={autoRotate}
            />
          ) : (
            <DefaultModel />
          )}
          {/* 使用本地HDR文件作为环境贴图 */}
          <Environment
            files="/assets/hdri/studio.hdr"
            background={false}
          />
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

      {/* 自动旋转控制按钮 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <button
          onClick={() => setAutoRotate(prev => !prev)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[99px] transition-colors ${
            autoRotate
              ? 'bg-[#2268eb] text-white hover:bg-[#2268eb]/90'
              : 'bg-[#ffffff1a] text-[#ffffffb2] hover:bg-[#ffffff26]'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${autoRotate ? 'animate-spin' : ''}`}
            style={{ animationDuration: '3s' }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          <span className="text-[14px] font-[500] leading-normal">
            {autoRotate ? '停止旋转' : '自动旋转'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ModelViewer;
