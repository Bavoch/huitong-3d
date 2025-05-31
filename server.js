import { createServer } from 'http';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { parse } from 'querystring';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 确保模型目录存在
const publicDir = join(__dirname, 'public');
const modelsDir = join(publicDir, 'models');
const distDir = join(__dirname, 'dist');

// 创建必要的目录
await Promise.all([
  mkdir(publicDir, { recursive: true }),
  mkdir(modelsDir, { recursive: true }),
  mkdir(distDir, { recursive: true })
]);

console.log('服务器启动配置:');
console.log('- 静态资源目录:', publicDir);
console.log('- 模型存储目录:', modelsDir);
console.log('- Vite 构建目录:', distDir);

// 获取文件MIME类型
function getMimeType(filename) {
  const ext = extname(filename).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.obj': 'model/obj',
    '.fbx': 'application/octet-stream',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// 处理文件上传
async function handleFileUpload(req, res) {
  return new Promise((resolve) => {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        // 解析上传的数据
        const formData = {};
        const parts = body.split('\r\n');
        let currentField = null;
        let fileContent = null;
        let fileName = null;
        let fileType = null;
        
        for (let i = 0; i < parts.length; i++) {
          const line = parts[i];
          
          if (line.includes('Content-Disposition: form-data')) {
            const nameMatch = line.match(/name="([^"]+)"/); 
            const filenameMatch = line.match(/filename="([^"]+)"/);
            
            if (nameMatch) {
              currentField = nameMatch[1];
            }
            
            if (filenameMatch) {
              fileName = filenameMatch[1];
              // 下一行通常是Content-Type
              if (parts[i+1].includes('Content-Type')) {
                fileType = parts[i+1].split(': ')[1];
                i++; // 跳过Content-Type行
              }
              
              // 跳过空行
              i++;
              
              // 从这里开始是文件内容，直到下一个边界
              fileContent = '';
              while (i+1 < parts.length && !parts[i+1].includes('Content-Disposition')) {
                fileContent += parts[i+1] + '\r\n';
                i++;
              }
              
              // 保存文件内容
              formData[currentField] = {
                fileName,
                fileType,
                content: fileContent
              };
            }
          }
        }
        
        // 如果找到了文件
        if (formData.modelFile && formData.modelFile.fileName) {
          const { fileName, content } = formData.modelFile;
          const safeFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const filePath = join(modelsDir, safeFileName);
          
          // 将Base64内容写入文件
          await writeFile(filePath, Buffer.from(content, 'base64'));
          
          // 返回成功响应
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            filePath: `/models/${safeFileName}`,
            fileName: fileName
          }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '未找到上传的文件' }));
        }
      } catch (error) {
        console.error('处理文件上传错误:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
      resolve();
    });
  });
}

const server = createServer(async (req, res) => {
  console.log(`收到请求: ${req.url}`);
  
  // 处理CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // 处理文件上传API
    if (req.method === 'POST' && req.url === '/api/upload-model') {
      await handleFileUpload(req, res);
      return;
    }
    
    // 处理静态文件请求
    if (req.method === 'GET') {
      // 默认页面
      if (req.url === '/' || req.url === '/index.html') {
        const content = await readFile(join(__dirname, 'index.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }
      
      // 尝试从dist目录加载文件
      try {
        // 处理根路径
        let filePath = req.url === '/' ? '/index.html' : req.url;
        filePath = filePath.split('?')[0]; // 移除查询参数
        
        // 安全地解析路径，防止目录遍历攻击
        const safePath = join(distDir, filePath)
          .replace(/\/\.\.?\//g, '/') // 移除相对路径
          .replace(/\.\./g, ''); // 移除父目录引用
        
        console.log('尝试加载文件:', safePath);
        
        // 确保路径在dist目录内
        if (!safePath.startsWith(distDir)) {
          throw new Error('非法路径');
        }
        
        const content = await readFile(safePath);
        const mimeType = getMimeType(safePath);
        
        // 设置缓存控制头
        const cacheControl = filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/) 
          ? 'public, max-age=31536000, immutable' 
          : 'no-cache';
        
        res.writeHead(200, { 
          'Content-Type': mimeType,
          'Cache-Control': cacheControl
        });
        res.end(content);
        return;
      } catch (error) {
        console.error('加载文件失败:', error.message);
        
        // 对于API请求，返回JSON格式的错误
        if (req.url.startsWith('/api/')) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not Found' }));
          return;
        }
        
        // 对于前端路由，返回index.html
        if (req.url.startsWith('/screen') || req.url.startsWith('/admin')) {
          try {
            const content = await readFile(join(distDir, 'index.html'));
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
            return;
          } catch (e) {
            console.error('无法加载index.html:', e);
          }
        }
        
        // 其他情况返回404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    }
    
    // 默认返回404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  } catch (err) {
    console.error('服务器错误:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
});

const PORT = 9000;

server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}/`);
});
