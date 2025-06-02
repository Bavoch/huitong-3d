#!/usr/bin/env node

/**
 * 端口配置验证脚本
 * 验证项目中所有配置都正确指向3000端口
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 需要检查的配置文件
const configFiles = [
  {
    path: 'package.json',
    checks: [
      { key: 'scripts.dev', expected: 'vite --port 3000 --host localhost' },
      { key: 'scripts.preview', expected: 'vite preview --port 3000' },
      { key: 'scripts.status', expected: 'lsof -i :3000 || echo \'没有进程在3000端口运行\'' }
    ]
  },
  {
    path: 'vite.config.ts',
    patterns: [
      { pattern: /port:\s*3000/, description: 'server.port 应该是 3000' },
      { pattern: /port:\s*3000/, description: 'hmr.port 应该是 3000' },
      { pattern: /port:\s*3000/, description: 'preview.port 应该是 3000' }
    ]
  }
];

// 验证函数
function verifyConfig() {
  console.log('🔍 开始验证端口配置...\n');
  
  let allValid = true;
  
  for (const config of configFiles) {
    const filePath = path.join(__dirname, config.path);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ 文件不存在: ${config.path}`);
      allValid = false;
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`📄 检查文件: ${config.path}`);
    
    if (config.checks) {
      // JSON 文件检查
      try {
        const json = JSON.parse(content);

        for (const check of config.checks) {
          const keys = check.key.split('.');
          let value = json;

          for (const key of keys) {
            value = value?.[key];
          }

          if (value === check.expected) {
            console.log(`  ✅ ${check.key}: ${value}`);
          } else {
            console.log(`  ❌ ${check.key}: 期望 "${check.expected}", 实际 "${value}"`);
            allValid = false;
          }
        }
      } catch (error) {
        console.log(`  ❌ 解析JSON失败: ${error.message}`);
        allValid = false;
      }
    }

    if (config.patterns) {
      // 正则表达式检查
      for (const check of config.patterns) {
        if (check.pattern.test(content)) {
          console.log(`  ✅ ${check.description}`);
        } else {
          console.log(`  ❌ ${check.description}`);
          allValid = false;
        }
      }
    }
    
    console.log('');
  }
  
  // 检查是否有意外的端口引用
  console.log('🔍 检查意外的端口引用...');
  
  const suspiciousPorts = ['3001', '5173', '4173'];
  let foundSuspicious = false;
  
  for (const port of suspiciousPorts) {
    const pattern = new RegExp(`\\b${port}\\b`, 'g');
    
    for (const config of configFiles) {
      const filePath = path.join(__dirname, config.path);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(pattern);
        
        if (matches) {
          console.log(`  ⚠️  在 ${config.path} 中发现端口 ${port} (${matches.length} 次)`);
          foundSuspicious = true;
        }
      }
    }
  }
  
  if (!foundSuspicious) {
    console.log('  ✅ 没有发现意外的端口引用');
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allValid && !foundSuspicious) {
    console.log('🎉 所有配置验证通过！项目已正确配置为使用3000端口。');
    console.log('\n📝 使用说明:');
    console.log('  - 启动开发服务器: npm run start');
    console.log('  - 访问地址: http://localhost:3000');
    console.log('  - 停止服务器: npm run stop');
    console.log('  - 检查状态: npm run status');
  } else {
    console.log('❌ 配置验证失败！请检查上述错误并修复。');
    process.exit(1);
  }
}

// 运行验证
verifyConfig();
