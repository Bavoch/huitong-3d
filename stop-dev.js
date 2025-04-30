import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 检查锁文件
const checkLockFile = () => {
  const lockFilePath = join(__dirname, '.dev-server-lock');
  if (fs.existsSync(lockFilePath)) {
    const port = fs.readFileSync(lockFilePath, 'utf8');
    return parseInt(port, 10);
  }
  return null;
};

// 删除锁文件
const removeLockFile = () => {
  const lockFilePath = join(__dirname, '.dev-server-lock');
  if (fs.existsSync(lockFilePath)) {
    fs.unlinkSync(lockFilePath);
    console.log(`删除锁文件: ${lockFilePath}`);
  }
};

// 查找并终止在指定端口上运行的进程
const killProcessOnPort = (port) => {
  return new Promise((resolve, reject) => {
    // 在Windows上使用netstat查找进程
    const command = process.platform === 'win32'
      ? `netstat -ano | findstr :${port}`
      : `lsof -i :${port} | grep LISTEN`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`查找进程时出错: ${error.message}`);
        return reject(error);
      }
      
      if (stderr) {
        console.error(`查找进程时出错: ${stderr}`);
        return reject(new Error(stderr));
      }
      
      // 解析输出以获取PID
      let pid;
      if (process.platform === 'win32') {
        // Windows输出格式: TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       12345
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes(`LISTENING`)) {
            const parts = line.trim().split(/\s+/);
            pid = parts[parts.length - 1];
            break;
          }
        }
      } else {
        // Unix输出格式: node      12345 user   17u  IPv4 1234567      0t0  TCP *:3000 (LISTEN)
        const match = stdout.match(/\s*\S+\s+(\d+)/);
        if (match && match[1]) {
          pid = match[1];
        }
      }
      
      if (!pid) {
        console.log(`没有找到在端口 ${port} 上运行的进程`);
        return resolve();
      }
      
      console.log(`找到在端口 ${port} 上运行的进程，PID: ${pid}`);
      
      // 终止进程
      const killCommand = process.platform === 'win32'
        ? `taskkill /F /PID ${pid}`
        : `kill -9 ${pid}`;
        
      exec(killCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`终止进程时出错: ${error.message}`);
          return reject(error);
        }
        
        console.log(`已终止进程 ${pid}`);
        resolve();
      });
    });
  });
};

// 停止开发服务器
const stopDevServer = async () => {
  const port = checkLockFile();
  
  if (!port) {
    console.log('没有找到开发服务器锁文件，服务器可能未运行');
    return;
  }
  
  console.log(`尝试停止在端口 ${port} 上运行的开发服务器...`);
  
  try {
    await killProcessOnPort(port);
    removeLockFile();
    console.log('开发服务器已停止');
  } catch (error) {
    console.error('停止开发服务器时出错:', error);
  }
};

// 执行主函数
stopDevServer().catch(error => {
  console.error('停止开发服务器时出错:', error);
});
