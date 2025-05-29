import { useEffect } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { checkAdminAuth, adminLogout } from "../../lib/adminAuth";
import { Button } from "../../components/ui/button";

export const AdminLayout = (): JSX.Element => {
  const navigate = useNavigate();
  
  // 检查管理员是否已登录
  useEffect(() => {
    const adminUser = checkAdminAuth();
    if (!adminUser) {
      navigate("/admin/login");
    }
  }, [navigate]);
  
  // 处理登出
  const handleLogout = () => {
    adminLogout();
    navigate("/admin/login");
  };
  
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200 py-3 shadow-sm">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">会通三维 - 后台管理系统</h1>
          <Button 
            variant="outline"
            onClick={handleLogout}
            className="border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            退出登录
          </Button>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 侧边导航 */}
          <aside className="col-span-2">
            <nav className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
              <ul className="space-y-1">
                <li>
                  <NavLink 
                    to="/admin/dashboard" 
                    className={({ isActive }) => 
                      `block px-4 py-2 rounded-md ${
                        isActive 
                          ? 'bg-blue-50 text-blue-600 font-medium' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    控制台
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/admin/models" 
                    className={({ isActive }) => 
                      `block px-4 py-2 rounded-md ${
                        isActive 
                          ? 'bg-blue-50 text-blue-600 font-medium' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    模型管理
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/admin/materials" 
                    className={({ isActive }) => 
                      `block px-4 py-2 rounded-md ${
                        isActive 
                          ? 'bg-blue-50 text-blue-600 font-medium' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    材质管理
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/"
                    className="block px-4 py-2 rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  >
                    返回前台
                  </NavLink>
                </li>
              </ul>
            </nav>
          </aside>
          
          {/* 主内容区 */}
          <main className="col-span-10 bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
