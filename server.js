import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = createServer(async (req, res) => {
  console.log(`收到请求: ${req.url}`);

  try {
    if (req.url === '/' || req.url === '/index.html') {
      const content = await readFile(join(__dirname, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } else if (req.url === '/test.html') {
      const content = await readFile(join(__dirname, 'public', 'test.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
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
