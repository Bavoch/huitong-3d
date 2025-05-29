import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../../lib/adminAuth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent } from "../../components/ui/card";

export const AdminLogin = (): JSX.Element => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const adminUser = adminLogin(username, password);
    if (adminUser) {
      navigate("/admin/dashboard");
    } else {
      setError("用户名或密码错误");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md bg-white shadow-sm">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">会通三维 - 管理员登录</h1>
            <p className="text-gray-500 mt-1">请输入您的管理员账号和密码</p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                用户名
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名"
                className="border-gray-200"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="border-gray-200"
                required
              />
            </div>
            
            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium"
              >
                登录
              </Button>
            </div>
            
            <div className="text-center text-gray-400 text-sm mt-4">
              <p>默认管理员账号: admin</p>
              <p>默认密码: admin123</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
