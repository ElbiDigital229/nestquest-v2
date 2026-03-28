import { useState } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { slugToRole, ROLE_LABELS } from "@/lib/role-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/ui/password-input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhoneInput } from "@/components/ui/phone-input";
import { Home, Loader2, Mail, Phone, ArrowLeft } from "lucide-react";

// ─── SSO Icons (inline SVGs for dummy buttons) ──────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GuestLogin({ roleSlug }: { roleSlug: string }) {
  const [, navigate] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const role = slugToRole(roleSlug);
  const roleLabel = role ? ROLE_LABELS[role] || role : "";

  // Email login state
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phone login state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Invalid role slug
  if (!role) {
    return <Redirect to="/" />;
  }

  // If already authenticated, redirect immediately
  if (user && ["GUEST", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT"].includes(user.role)) {
    return <Redirect to="/portal/settings" />;
  }

  // ── Email Login ─────────────────────────────────────────

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Please enter your email and password", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/login", { email, password, role });
      await refreshUser();
      toast({ title: "Welcome back!" });
    } catch (error: any) {
      toast({ title: error.message || "Login failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Phone Login — Send OTP ──────────────────────────────

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      toast({ title: "Please enter your phone number", variant: "destructive" });
      return;
    }

    setIsSendingOtp(true);
    try {
      const data = await api.post<{ hint?: string }>("/auth/send-login-otp", { phone, role });
      setOtpSent(true);
      toast({ title: data.hint || "OTP sent to your phone" });
    } catch (error: any) {
      toast({ title: error.message || "Failed to send OTP", variant: "destructive" });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // ── Phone Login — Verify OTP ────────────────────────────

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      toast({ title: "Please enter the 6-digit OTP", variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    try {
      await api.post("/auth/verify-login-otp", { phone, otp, role });
      await refreshUser();
      toast({ title: "Welcome back!" });
    } catch (error: any) {
      toast({ title: error.message || "OTP verification failed", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  // ── SSO handler (dummy) ─────────────────────────────────

  const handleSSO = (provider: string) => {
    toast({ title: `${provider} sign-in coming soon`, description: "This feature is not yet available." });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Link href="/" className="absolute left-4 top-4 text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Home className="h-6 w-6 text-primary-foreground" />
          </div>
          <Badge variant="secondary" className="mx-auto mb-2">{roleLabel}</Badge>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to your {roleLabel.toLowerCase()} account</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── SSO Buttons ──────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <Button variant="outline" className="w-full" onClick={() => handleSSO("Google")}>
              <GoogleIcon className="h-5 w-5" />
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleSSO("Microsoft")}>
              <MicrosoftIcon className="h-5 w-5" />
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleSSO("Apple")}>
              <AppleIcon className="h-5 w-5" />
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or continue with</span>
            </div>
          </div>

          {/* ── Email / Phone Tabs ────────────────────── */}
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger
                value="phone"
                className="flex items-center gap-2"
                onClick={() => {
                  if (otpSent) {
                    setOtpSent(false);
                    setOtp("");
                  }
                }}
              >
                <Phone className="h-4 w-4" />
                Phone
              </TabsTrigger>
            </TabsList>

            {/* ── Email Tab ──────────────────────────── */}
            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            {/* ── Phone Tab ──────────────────────────── */}
            <TabsContent value="phone">
              <div className="space-y-4 pt-2">
                {!otpSent ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <PhoneInput
                        value={phone}
                        onChange={setPhone}
                        disabled={isSendingOtp}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                    >
                      {isSendingOtp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Send OTP
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-3 text-center">
                      <p className="text-sm text-muted-foreground">
                        Enter the 6-digit code sent to <span className="font-medium text-foreground">{phone}</span>
                      </p>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleVerifyOtp}
                      disabled={isVerifying || otp.length < 6}
                    >
                      {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Verify & Sign In
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                      }}
                    >
                      Change phone number
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground text-center w-full">
            Don't have an account?{" "}
            <Link href={`/signup/${roleSlug}`} className="text-primary hover:underline font-medium">
              Sign Up
            </Link>
          </p>
          <Link href="/" className="text-xs text-muted-foreground hover:underline">
            Choose a different account type
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
