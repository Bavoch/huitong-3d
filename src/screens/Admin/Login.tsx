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
    <div className="flex items-center justify-center min-h-screen bg-app-bg">
      <Card className="w-full max-w-md bg-container shadow-sm">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-text-primary">会通智能色彩云库 - 管理员登录</h1>
            <p className="text-text-secondary mt-1">请输入您的管理员账号和密码</p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-lg py-sm rounded mb-lg text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-lg">
            <div className="space-y-sm">
              <label htmlFor="username" className="block text-sm font-medium text-text-secondary">
                用户名
              </label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名"
                className="bg-input-bg border-border-subtle text-text-primary"
                required
              />
            </div>

            <div className="space-y-sm">
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                密码
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                className="bg-input-bg border-border-subtle text-text-primary"
                required
              />
            </div>

            <div className="pt-sm">
              <Button
                type="submit"
                className="w-full btn-primary font-medium"
              >
                登录
              </Button>
            </div>

            <div className="text-center text-text-tertiary text-sm mt-lg">
              <p>默认管理员账号: admin</p>
              <p>默认密码: admin123</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
