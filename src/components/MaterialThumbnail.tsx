import React, { useRef, useEffect, useState } from 'react';

interface MaterialThumbnailProps {
  color: string;      // 16进制颜色值，如 "#FF0000"
  roughness: number;   // 0-1 范围
  metallic: number;    // 0-1 范围
  size?: number;       // 缩略图大小，默认 64px
  className?: string;
}

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_texcoord;
  
  void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texcoord = a_position * 0.5 + 0.5;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  
  varying vec2 v_texcoord;
  
  uniform vec3 u_albedo;
  uniform float u_roughness;
  uniform float u_metallic;
  
  // 简单的GGX BRDF近似
  float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float nom = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = 3.14159265359 * denom * denom;

    return nom / denom;
  }

  // 几何函数
  float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;

    float nom = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
  }


  // 几何函数
  float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx1 = GeometrySchlickGGX(NdotV, roughness);
    float ggx2 = GeometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
  }

  // 菲涅尔方程
  vec3 FresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
  }

  void main() {
    // 计算UV坐标（从-1到1映射到0到1）
    vec2 uv = v_texcoord;
    
    // 计算球面法线
    vec2 p = uv * 2.0 - 1.0;
    float radius = length(p);
    if (radius > 1.0) {
      discard;
    }
    
    vec3 N = vec3(p.x, p.y, sqrt(1.0 - radius * radius));
    vec3 V = vec3(0.0, 0.0, 1.0);
    
    // 光照参数
    vec3 lightPos = vec3(1.0, 1.0, 1.0);
    vec3 L = normalize(lightPos);
    vec3 H = normalize(V + L);
    
    // 基础反射率
    vec3 F0 = mix(vec3(0.04), u_albedo, u_metallic);
    
    // 计算辐射度
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    
    // Cook-Torrance BRDF
    float NDF = DistributionGGX(N, H, u_roughness);   
    float G = GeometrySmith(N, V, L, u_roughness);     
    vec3 F = FresnelSchlick(max(dot(H, V), 0.0), F0);
    
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - u_metallic;
    
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * NdotV * NdotL + 0.0001;
    vec3 specular = numerator / denominator;
    
    // 出射辐射度
    vec3 Lo = (kD * u_albedo / 3.14159265359 + specular) * NdotL;
    
    // 环境光
    vec3 ambient = vec3(0.03) * u_albedo;
    
    vec3 color = ambient + Lo;
    
    // HDR色调映射
    color = color / (color + vec3(1.0));
    // Gamma校正
    color = pow(color, vec3(1.0/2.2));
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const MaterialThumbnail: React.FC<MaterialThumbnailProps> = ({
  color,
  roughness,
  metallic,
  size = 64,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 设置画布大小
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    
    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      setWebGLSupported(false);
      return;
    }
    
    setWebGLSupported(true);
    
    // 编译着色器
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    
    // 检查着色器编译错误
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
      return;
    }
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
      return;
    }
    
    // 创建着色程序
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      return;
    }
    
    // 设置顶点数据
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    // 全屏四边形
    const positions = [
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    // 转换颜色格式
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    const albedo = [r, g, b];
    
    // 渲染
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.useProgram(program);
    
    // 设置属性
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    
    // 设置uniforms
    const albedoLocation = gl.getUniformLocation(program, 'u_albedo');
    const roughnessLocation = gl.getUniformLocation(program, 'u_roughness');
    const metallicLocation = gl.getUniformLocation(program, 'u_metallic');
    
    gl.uniform3fv(albedoLocation, albedo);
    gl.uniform1f(roughnessLocation, roughness);
    gl.uniform1f(metallicLocation, metallic);
    
    // 绘制
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    // 清理
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
  }, [color, roughness, metallic, size]);
  

  // 如果WebGL不支持，则显示CSS回退方案
  if (!webGLSupported) {
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

  // WebGL支持，返回画布
  return (
    <div 
      className={`rounded-full overflow-hidden ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-block',
        lineHeight: 0, // 防止底部有额外的空间
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};
