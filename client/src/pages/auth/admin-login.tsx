import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user && user.role === "SUPER_ADMIN") {
    return <Redirect to="/admin/users" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast({ title: "Please enter your email and password", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/login", { email, password, role: "SUPER_ADMIN" });
      await refreshUser();
      toast({ title: "Welcome, Admin" });
      // Redirect handled declaratively via user state check above
    } catch (error: any) {
      toast({ title: error.message || "Login failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Admin Access</CardTitle>
          <CardDescription>Sign in to the administration panel</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {import.meta.env.DEV && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-800 mb-2">Quick Login (Dev Only)</p>
                <select
                  className="w-full h-9 rounded-md border border-amber-300 bg-white px-3 text-sm"
                  defaultValue=""
                  onChange={async (e) => {
                    if (!e.target.value) return;
                    setIsLoading(true);
                    try {
                      await api.post("/auth/login", { email: "admin@nestquest.com", password: "Test1234!", role: "SUPER_ADMIN" });
                      await refreshUser();
                      toast({ title: "Welcome, Admin" });
                    } catch (err: any) {
                      toast({ title: err.message, variant: "destructive" });
                    } finally { setIsLoading(false); }
                  }}
                >
                  <option value="">Select a test account...</option>
                  <option value="admin">Admin — admin@nestquest.com</option>
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@nestquest.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
