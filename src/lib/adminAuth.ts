/**
 * 管理员认证工具
 */

// 管理员用户类型
export type AdminUser = {
  username: string;
  role: 'admin';
  lastLogin: string;
};

// 存储键名
const ADMIN_AUTH_KEY = 'huitong3d_admin_auth';
const ADMIN_USERNAME = 'admin'; // 默认管理员用户名
const ADMIN_PASSWORD = 'admin123'; // 默认管理员密码（实际项目中应使用更安全的方式）

/**
 * 管理员登录
 * @param username 用户名
 * @param password 密码
 * @returns 登录成功返回管理员信息，失败返回null
 */
export const adminLogin = (username: string, password: string): AdminUser | null => {
  // 简单的验证逻辑
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const adminUser: AdminUser = {
      username,
      role: 'admin',
      lastLogin: new Date().toISOString()
    };
    
    // 保存到本地存储
    localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(adminUser));
    return adminUser;
  }
  
  return null;
};

/**
 * 检查管理员是否已登录
 * @returns 已登录返回管理员信息，未登录返回null
 */
export const checkAdminAuth = (): AdminUser | null => {
  const adminJson = localStorage.getItem(ADMIN_AUTH_KEY);
  if (!adminJson) return null;
  
  try {
    return JSON.parse(adminJson) as AdminUser;
  } catch (error) {
    console.error('解析管理员认证信息失败:', error);
    return null;
  }
};

/**
 * 管理员登出
 */
export const adminLogout = (): void => {
  localStorage.removeItem(ADMIN_AUTH_KEY);
};
