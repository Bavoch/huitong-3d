import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Screen } from "./screens/Screen";
import { 
  AdminLogin, 
  AdminLayout, 
  AdminDashboard, 
  ModelsManagement, 
  MaterialsManagement 
} from "./screens/Admin";
import { ToastProvider, useToast, setToastFunction } from "./components/ui/toast";

// 根组件，用于初始化全局通知函数
const App = () => {
  const { showToast } = useToast();
  
  useEffect(() => {
    // 设置全局通知函数
    setToastFunction(showToast);
  }, [showToast]);

  return (
    <BrowserRouter>
      <Routes>
        {/* 前台路由 */}
        <Route path="/" element={<Screen />} />
        
        {/* 管理员路由 */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="" element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="models" element={<ModelsManagement />} />
          <Route path="materials" element={<MaterialsManagement />} />
        </Route>
        
        {/* 404路由 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
