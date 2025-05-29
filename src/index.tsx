import { StrictMode } from "react";
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

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
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
  </StrictMode>,
);
