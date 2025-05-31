import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface MaterialThumbnailProps {
  color: string;      // 16进制颜色值，如 "#FF0000"
  roughness: number;   // 0-1 范围
  metallic: number;    // 0-1 范围
  size?: number;       // 缩略图大小，默认 64px
  className?: string;
}

// 材质预览球体组件
const MaterialSphere: React.FC<{
  color: string;
  roughness: number;
  metallic: number;
}> = ({ color, roughness, metallic }) => {
  // 创建PBR材质
  const material = useRef<THREE.MeshStandardMaterial>(null);
  
  // 更新材质属性
  useEffect(() => {
    if (material.current) {
      material.current.color.set(color);
      material.current.roughness = roughness;
      material.current.metalness = metallic;
    }
  }, [color, roughness, metallic]);
  
  return (
    <mesh position={[0, 0, 0]} castShadow>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial 
        ref={material} 
        color={color} 
        roughness={roughness} 
        metalness={metallic} 
      />
    </mesh>
  );
};

// 材质渲染场景组件 - 使用HDR环境贴图
const MaterialScene: React.FC<{
  color: string;
  roughness: number;
  metallic: number;
}> = ({ color, roughness, metallic }) => {
  return (
    <>
      <MaterialSphere color={color} roughness={roughness} metallic={metallic} />
      {/* 使用与前台相同的HDR环境贴图 */}
      <Environment
        files="/assets/hdri/studio.hdr"
        background={false}
      />
      <OrbitControls enabled={false} />
      <ambientLight intensity={0.1} />
    </>
  );
};

// 暴露截图功能的全局方法
export const captureMaterialThumbnail = (): string | null => {
  // 如果全局方法存在，则调用它
  if (window && (window as any).captureMaterialScreenshot) {
    return (window as any).captureMaterialScreenshot();
  }
  return null;
};

export const MaterialThumbnail: React.FC<MaterialThumbnailProps> = ({
  color,
  roughness,
  metallic,
  size = 64,
  className = '',
}) => {
  const [canvasSupported, setCanvasSupported] = useState(true);
  
  useEffect(() => {
    // 检查Three.js和WebGL是否受支持
    try {
      const testRenderer = new THREE.WebGLRenderer();
      testRenderer.dispose();
      setCanvasSupported(true);
    } catch (error) {
      console.error('WebGL不支持或Three.js初始化失败:', error);
      setCanvasSupported(false);
    }
  }, []);
  
  // 如果不支持Canvas/WebGL，则显示CSS回退方案
  if (!canvasSupported) {
    // 不需要解析颜色，直接使用原始颜色字符串
    
    return (
      <div 
        className={`rounded-full ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'inline-block',
          backgroundColor: color,
          backgroundImage: `linear-gradient(135deg, rgba(255, 255, 255, ${0.9 - roughness * 0.9}) 0%, rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, ${0.2 + roughness * 0.2}) 100%)`,
          boxShadow: `inset 0 0 10px rgba(255, 255, 255, ${metallic * 0.8})`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 高光反射点 */}
        <div 
          style={{
            position: 'absolute',
            width: `${6 - roughness * 4}px`,
            height: `${6 - roughness * 4}px`,
            backgroundColor: 'white',
            opacity: metallic * 0.9 + 0.1,
            top: '25%',
            left: '25%',
            borderRadius: '50%',
            filter: `blur(${roughness * 2}px)`,
          }}
        />
        
        {/* 金属质感光泽 */}
        {metallic > 0.3 && (
          <div 
            style={{
              position: 'absolute',
              width: '100%',
              height: '30%',
              top: 0,
              left: 0,
              opacity: 0.6,
              background: `linear-gradient(180deg, rgba(255,255,255,${metallic * 0.7}) 0%, rgba(255,255,255,0) 100%)`,
              borderTopLeftRadius: '100px',
              borderTopRightRadius: '100px',
            }}
          />
        )}
      </div>
    );
  }

    // 创建一个ref来获取Canvas容器元素
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  // 截图功能
  const captureScreenshot = useCallback((): string | null => {
    if (!canvasContainerRef.current) return null;
    
    // 获取canvas元素
    const canvas = canvasContainerRef.current.querySelector('canvas');
    if (!canvas) return null;
    
    // 从canvas生成图像数据URL
    try {
      // 确保使用正确的设置获取高质量图像
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('材质截图失败:', error);
      return null;
    }
  }, []);
  
  // 暴露截图方法给全局对象
  useEffect(() => {
    (window as any).captureMaterialScreenshot = captureScreenshot;
    
    return () => {
      // 清理
      if ((window as any).captureMaterialScreenshot) {
        delete (window as any).captureMaterialScreenshot;
      }
    };
  }, [captureScreenshot]);

  // 使用Three.js和react-three-fiber渲染PBR材质预览
  return (
    <div 
      className={`rounded-full overflow-hidden ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-block',
        lineHeight: 0,
      }}
      ref={canvasContainerRef}
    >
      <Canvas
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} // 确保可以截图
        dpr={[1, 2]}
        camera={{ position: [0, 0, 2.5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <MaterialScene 
          color={color} 
          roughness={roughness} 
          metallic={metallic} 
        />
      </Canvas>
    </div>
  );
};
