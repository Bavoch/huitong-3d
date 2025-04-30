import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 检查是否有开发服务器已经在运行
const checkServerRunning = async (port) => {
  try {
    const response = await fetch(`http://localhost:${port}/`);
    return response.status !== 404; // 如果能获取响应且不是404，说明服务器在运行
  } catch (error) {
    return false; // 如果无法连接，说明服务器没有运行
  }
};

// 创建一个锁文件来标记服务器正在运行
const createLockFile = (port) => {
  const lockFilePath = join(__dirname, '.dev-server-lock');
  fs.writeFileSync(lockFilePath, port.toString());
  console.log(`创建锁文件: ${lockFilePath}`);
};

// 检查锁文件
const checkLockFile = () => {
  const lockFilePath = join(__dirname, '.dev-server-lock');
  if (fs.existsSync(lockFilePath)) {
    const port = fs.readFileSync(lockFilePath, 'utf8');
    return parseInt(port, 10);
  }
  return null;
};

// 启动开发服务器
const startDevServer = async () => {
  // 检查锁文件
  const lockedPort = checkLockFile();
  if (lockedPort) {
    // 检查服务器是否真的在运行
    const isRunning = await checkServerRunning(lockedPort);
    if (isRunning) {
      console.log(`开发服务器已经在端口 ${lockedPort} 上运行`);
      console.log(`请访问 http://localhost:${lockedPort}/`);
      return;
    } else {
      console.log(`锁文件存在但服务器未运行，将启动新服务器`);
    }
  }

  console.log('启动开发服务器...');
  
  // 使用 spawn 启动 npm run dev
  const devProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    detached: false // 不分离进程，这样当脚本结束时，开发服务器也会结束
  });

  // 监听进程退出
  devProcess.on('exit', (code) => {
    console.log(`开发服务器已退出，退出码: ${code}`);
  });

  // 监听错误
  devProcess.on('error', (err) => {
    console.error('启动开发服务器时出错:', err);
  });

  // 创建锁文件
  createLockFile(3000);
};

// 执行主函数
startDevServer().catch(error => {
  console.error('启动开发服务器时出错:', error);
});
