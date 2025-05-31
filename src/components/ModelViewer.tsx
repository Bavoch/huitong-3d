import React, { useRef, useEffect, useState, Suspense, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { type Model } from '../lib/localStorage';

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

// 默认模型组件 - 当没有实际模型时显示一个基础几何体
function DefaultModel() {
  return (
    <group>
      {/* 使用基础几何体代替空模型 */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.2} />
      </mesh>
      <Html position={[0, 1.5, 0]} center>
        <div className="bg-black/70 text-white px-6 py-4 rounded-md text-center">
          <div className="text-white font-medium text-lg">使用默认模型显示</div>
          <div className="text-gray-300 mt-2 text-sm">原模型文件不可用或正在加载</div>
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

  // 规范化模型路径，删除前导斜杠
  const getNormalizedPath = (path: string | null): string | null => {
    if (!path) return null;
    // 如果是 /blob: 开头，删除前导斜杠
    if (path.startsWith('/blob:')) {
      return path.substring(1); // 移除前导斜杠
    }
    return path;
  };

  // 计算规范化的路径
  const normalizedPath = useMemo(() => {
    const normalized = getNormalizedPath(modelPath);
    if (normalized && normalized !== modelPath) {
      console.log("规范化路径 - 原始:", modelPath, "规范化后:", normalized);
    }
    return normalized;
  }, [modelPath]);

  // 尝试加载模型
  useEffect(() => {
    console.log("ModelViewer: modelPath/loadAttempts useEffect. modelPath:", modelPath, "normalizedPath:", normalizedPath, "Attempts:", loadAttempts);
    // 检查模型路径是否变化
    const isPathChanged = previousPathRef.current !== modelPath;
    previousPathRef.current = modelPath;

    // 如果路径变化，重置加载尝试次数
    if (isPathChanged) {
      setLoadAttempts(0);
    }

    // 如果没有提供模型路径，使用默认模型
    if (!normalizedPath) {
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
    if (!normalizedPath.startsWith('blob:')) {
      // 对于非Blob URL，检查路径是否有效
      try {
        // 检查文件扩展名
        const fileExtension = modelPath.split('.').pop()?.toLowerCase();

        if (!['glb', 'gltf'].includes(fileExtension || '')) {
          console.error('不支持的文件格式:', fileExtension);
          setError(`不支持的文件格式: ${fileExtension}`);
          setUseDefaultModel(true);
          return;
        }
      } catch (e) {
        console.error('模型路径验证出错:', modelPath, e);
        setError('模型路径无效');
        setUseDefaultModel(true);
        return;
      }
    }
  }, [modelPath, loadAttempts]);

  // 处理模型加载错误
  const handleModelError = useCallback(() => {
    console.error('模型加载失败:', modelPath);

    // 如果尝试次数小于3，增加尝试次数并重试
    if (loadAttempts < 2) {
      // 自动重试加载模型
      setLoadAttempts(prev => prev + 1);
    } else {
      // 超过最大尝试次数，显示错误
      setError('模型加载失败');
      setUseDefaultModel(true);
    }
  }, [modelPath, loadAttempts]);

  // 手动重试加载
  const handleRetry = useCallback(() => {
    // 手动重试加载模型
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
  
  // 规范化模型路径函数
  const getNormalizedPath = (path: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith('/blob:')) {
      return path.substring(1); // 移除前导斜杠
    }
    return path;
  };

  // 计算规范化的路径
  const normalizedPath = useMemo(() => {
    const normalized = getNormalizedPath(modelPath);
    if (normalized && normalized !== modelPath) {
      console.log("ModelObject: 规范化路径 - 原始:", modelPath, "规范化后:", normalized);
    }
    return normalized || '';
  }, [modelPath]);

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
      // 尝试重新加载模型
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
          const loader = new GLTFLoader(manager);

          // 添加超时处理
          const timeoutId = setTimeout(() => {
            reject(new Error('加载超时'));
          }, 10000); // 10秒超时

          // 开始加载
          console.log('开始加载模型:', url);
          loader.load(
            url,
            (gltf: any) => {
              // 清除超时
              clearTimeout(timeoutId);
              console.log('模型加载成功:', url, gltf);

              // GLTF模型已加载
              if (isMounted) {
                setLoadProgress(95);
                setLoadStage('处理中');
                
                try {
                  // 使用加载好的GLTF模型
                  if (gltf && gltf.scene) {
                    resolve(gltf.scene);
                  } else {
                    reject(new Error('加载的模型没有场景'));
                  }
                } catch (error) {
                  reject(error);
                }
              } else {
                reject(new Error('组件已卸载'));
              }
            },
            // 进度回调
            (xhr: any) => {
              if (xhr.lengthComputable && isMounted) {
                const progress = Math.min(Math.round((xhr.loaded / xhr.total) * 80), 80);
                setLoadProgress(progress);
              }
            },
            // 错误回调
            (error: any) => {
              clearTimeout(timeoutId);
              console.error('模型加载错误:', url, error);
              reject(error);
            }
          );
        });
      };

      // 跳过HEAD请求检查，直接尝试加载模型
      try {

        // 使用进度跟踪器加载模型
        let gltfScene;

        // 使用规范化后的路径
        let modelUrl = normalizedPath;
        console.log('加载模型函数 - 原始路径:', modelPath, '规范化后路径:', normalizedPath);
        
        // 检查URL格式
        if (!modelUrl) {
          throw new Error('模型路径为空');
        }
        
        // 处理不同类型的URL
        if (!modelUrl.startsWith('blob:') && !modelUrl.startsWith('http')) {
          // 对于本地文件路径，确保以 / 开头
          modelUrl = modelUrl.startsWith('/') ? modelUrl : `/${modelUrl}`;
          console.log('规范化后的模型路径:', modelUrl);
        } else {
          console.log('使用blob/http模型路径:', modelUrl);
        }
        
        // 使用进度跟踪器加载模型，添加超时保护
        const loadPromise = createProgressTracker(modelUrl);
        
        // 创建超时Promise
        const timeoutPromise = new Promise<THREE.Group>((_, reject) => {
          setTimeout(() => reject(new Error('模型加载全局超时')), 20000); // 20秒全局超时
        });
        
        // 使用Promise.race竞争，谁先完成就用谁的结果
        try {
          gltfScene = await Promise.race([loadPromise, timeoutPromise]);
        } catch (error) {
          console.error('模型加载出错或超时:', error);
          throw error; // 重新抛出错误，让外层catch捕获
        }

        if (!isMounted) return;

        if (gltfScene) {
          // 模型场景加载成功，开始处理
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

          // 模型处理完成，设置到场景
          setLoadProgress(100);
          setLoadStage('完成');
          setModelScene(scene);
          setIsLoading(false); // 加载完成
        } else {
          console.error('模型加载失败: 无效的场景');
          throw new Error('模型加载失败: 无效的场景');
        }
      } catch (error) {
        console.error('加载模型失败:', error instanceof Error ? error.message : error);
        if (isMounted) {
          if (retryCount < maxRetries) {
            // 加载失败，自动重试
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
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  selectedModel,
  customColor,
  customRoughness,
  customMetallic
}) => {
  const [modelViewKey, setModelViewKey] = useState<string>('');
  const [modelValid, setModelValid] = useState<boolean>(true);
  const [modelPath, setModelPath] = useState<string>('');
  const previousModelIdRef = useRef<string>('');
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const defaultCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);

  // 验证和处理模型路径
  useEffect(() => {
    if (selectedModel) {
      // 检查模型是否变化
      const modelChanged = previousModelIdRef.current !== selectedModel.id;
      previousModelIdRef.current = selectedModel.id;

      // 验证文件路径
      try {
        let filePath = selectedModel.file_path;
        
        // 判断是否为旧的错误路径
        if (filePath.includes('office_chair') || filePath === '/duck.glb') {
          console.warn('发现无效模型路径，切换到默认模型:', filePath);
          // 如果是已知的错误路径，替换为默认模型
          filePath = '/models/blenderco_cn.glb';
        }
        
        // 处理相对路径
        if (filePath.startsWith('/')) {
          // 如果是绝对路径，确保它指向 public 目录
          filePath = filePath.startsWith('/public') ? filePath : filePath;
        } else {
          // 如果是相对路径，添加 / 前缀
          filePath = filePath.startsWith('./') ? filePath.substring(1) : `/${filePath}`;
        }

        // 检查文件扩展名
        const originalFileName = selectedModel.name; // Get the original filename
        const fileExtension = originalFileName.split('.').pop()?.toLowerCase(); // Extract extension from original name

        // 检查是否为支持的格式
        const isValidFormat = ['glb', 'gltf'].includes(fileExtension || '');
        setModelValid(isValidFormat);

        if (isValidFormat) {
          // 设置模型路径
          setModelPath(filePath);

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

    // 查找模型对象并计算包围盒
    let modelBox = new THREE.Box3();
    let hasModel = false;

    // 遍历场景中的所有对象，找到包含网格的对象并计算总包围盒
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        hasModel = true;
        // 扩展包围盒以包含此网格
        modelBox.expandByObject(object);
      }
    });

    // 如果找到模型，居中所有对象
    if (hasModel) {
      // 获取包围盒的中心和大小
      const center = modelBox.getCenter(new THREE.Vector3());
      const size = modelBox.getSize(new THREE.Vector3());

      // 创建一个组来包含所有模型部分
      const modelGroup = new THREE.Group();

      // 将所有子对象移动到新组中，并调整位置
      while (scene.children.length > 0) {
        const child = scene.children[0];
        scene.remove(child);
        modelGroup.add(child);
      }

      // 调整组的位置，使模型居中
      modelGroup.position.set(-center.x, -center.y, -center.z);

      // 将组添加回场景
      scene.add(modelGroup);

      // 调整相机视角以适应新的尺寸比例和模型大小
      if (camera instanceof THREE.PerspectiveCamera) {
        // 设置相机比例为1:1
        camera.aspect = 1;
        camera.updateProjectionMatrix();

        // 根据模型大小调整相机位置
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        // 添加一些边距
        cameraZ *= 1.5;

        // 更新相机位置
        camera.position.set(0, 0, cameraZ);

        // 确保相机看向模型中心
        camera.lookAt(new THREE.Vector3(0, 0, 0));
        camera.updateProjectionMatrix();
      }
    } else {
      // 如果没有找到模型，使用默认相机设置
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = 1; // 1:1 比例
        camera.position.set(0, 0, 5);
        camera.lookAt(new THREE.Vector3(0, 0, 0));
        camera.updateProjectionMatrix();
      }
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

  // 创建默认摄像机
  useEffect(() => {
    if (!defaultCameraRef.current) {
      // 设置更合适的视野角度和远近裁剪面
      defaultCameraRef.current = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      // 设置默认摄像机位置，从斜上方45度角观察，距离稍远以获得更好的视角
      defaultCameraRef.current.position.set(3, 3, 3);
      defaultCameraRef.current.lookAt(0, 0, 0);
    }
  }, []);

  // 恢复默认视图
  const resetToDefaultView = useCallback(() => {
    if (controlsRef.current && defaultCameraRef.current && cameraRef.current) {
      // 重置控制器到初始位置
      controlsRef.current.reset();
      
      // 设置相机到默认位置
      cameraRef.current.position.copy(defaultCameraRef.current.position);
      cameraRef.current.rotation.copy(defaultCameraRef.current.rotation);
      cameraRef.current.updateProjectionMatrix();
    }
  }, [controlsRef, cameraRef]);

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
          cameraRef.current = camera as THREE.PerspectiveCamera;
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
            ref={controlsRef}
            enableZoom={true}
            enablePan={false}
            enableDamping={false}
            dampingFactor={0}
            minDistance={2}
            maxDistance={10}
          />
        </Suspense>
      </Canvas>

      {/* 控制按钮区域 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 inline-flex justify-start items-center gap-3">
        {/* 默认视图按钮 */}
        <div
          className="pl-2 pr-1 py-1 bg-背景-容器背景1/5 rounded-[99px] flex justify-start items-center gap-1.5 cursor-pointer"
          onClick={resetToDefaultView}
        >
          <div className="justify-start text-内容-常规/70 text-sm font-medium font-['PingFang_SC']">默认视图</div>
          <div className="w-4 h-4 relative overflow-hidden">
            <div className="w-3 h-3 left-[2px] top-[2px] absolute outline outline-1 outline-offset-[-0.50px] outline-内容-常规/70" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelViewer;
