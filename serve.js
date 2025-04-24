import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { stat } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MIME类型映射
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = createServer(async (req, res) => {
  console.log(`收到请求: ${req.url}`);
  
  try {
    // 解析URL，移除查询字符串
    let url = req.url.split('?')[0];
    
    // 如果URL是根路径，默认提供index.html
    if (url === '/') {
      url = '/index.html';
    }
    
    // 构建文件路径
    const filePath = join(__dirname, 'dist', url);
    
    // 检查文件是否存在
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        throw new Error('不是文件');
      }
    } catch (err) {
      console.error(`文件不存在: ${filePath}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    
    // 获取文件扩展名
    const ext = extname(filePath);
    
    // 获取MIME类型
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    // 读取文件
    const content = await readFile(filePath);
    
    // 发送响应
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
    
  } catch (err) {
    console.error('服务器错误:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
});

const PORT = 9000;

server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}/`);
  console.log(`提供的是构建目录: ${join(__dirname, 'dist')}`);
});
