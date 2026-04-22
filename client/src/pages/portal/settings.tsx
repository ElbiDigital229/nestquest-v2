import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, kycBadgeProps, statusBadgeProps } from "@/lib/role-utils";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Globe,
  CreditCard,
  Building2,
  Pencil,
  X,
  Save,
  Loader2,
  LogIn,
  UserPlus,
  Settings,
  Key,
  Clock,
  Activity,
  FileText,
  Shield,
  Upload,
  AlertTriangle,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  "UAE", "Saudi Arabia", "Oman", "Bahrain", "Qatar", "Kuwait",
  "India", "Pakistan", "Philippines", "United Kingdom", "United States",
  "Canada", "Australia", "Germany", "France", "China", "Egypt",
  "Jordan", "Lebanon", "South Africa", "Nigeria", "Kenya", "Brazil",
  "Russia", "Japan", "South Korea", "Turkey", "Iran", "Iraq", "Syria",
  "Yemen", "Afghanistan", "Bangladesh", "Sri Lanka", "Nepal",
  "Indonesia", "Malaysia", "Singapore", "Thailand", "Vietnam",
  "New Zealand", "Ireland", "Italy", "Spain", "Portugal", "Netherlands",
  "Belgium", "Sweden", "Norway", "Denmark", "Finland", "Switzerland",
  "Austria", "Poland", "Czech Republic", "Romania", "Hungary", "Greece",
  "Argentina", "Chile", "Colombia", "Mexico", "Peru",
];

// ─── Types ───────────────────────────────────────────────────────────────────

// Matches the response from GET /api/auth/me
interface ProfileResponse {
  user: {
    id: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    createdAt: string;
  };
  profile: {
    id: number;
    userId: string;
    fullName: string;
    dob: string;
    nationality: string;
    countryOfResidence: string;
    residentAddress: string;
    emiratesIdNumber: string;
    emiratesIdExpiry: string;
    emiratesIdFrontUrl: string;
    emiratesIdBackUrl: string;
    passportNumber: string | null;
    passportExpiry: string | null;
    passportFrontUrl: string | null;
    tradeLicenseExpiry: string | null;
    tradeLicenseUrl: string | null;
    companyName: string | null;
    companyWebsite: string | null;
    companyDescription: string | null;
    companyAddress: string | null;
    kycStatus: string;
  } | null;
}

type SubscriptionData = {
  id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  planName: string;
  planPrice: string;
  planBillingCycle: string;
} | null;

interface InvoiceEntry {
  id: string;
  amount: string;
  status: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  createdAt?: string;
  planName: string;
}

interface AuditEntry {
  id: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActionIcon(action: string) {
  switch (action) {
    case "LOGIN":
    case "GUEST_LOGIN":
      return LogIn;
    case "ACCOUNT_CREATED":
    case "SIGNUP":
    case "GUEST_SIGNUP":
      return UserPlus;
    case "PROFILE_UPDATED":
    case "PROFILE_UPDATE":
    case "GUEST_PROFILE_UPDATE":
      return Settings;
    case "PASSWORD_CHANGED":
    case "PASSWORD_CHANGE":
      return Key;
    case "LOGOUT":
      return LogIn;
    default:
      return Activity;
  }
}

function getActionLabel(action: string): string {
  switch (action) {
    case "LOGIN":
    case "GUEST_LOGIN":
      return "Signed in";
    case "ACCOUNT_CREATED":
    case "SIGNUP":
    case "GUEST_SIGNUP":
      return "Account created";
    case "PROFILE_UPDATED":
    case "PROFILE_UPDATE":
    case "GUEST_PROFILE_UPDATE":
      return "Profile updated";
    case "PASSWORD_CHANGED":
    case "PASSWORD_CHANGE":
      return "Password changed";
    case "LOGOUT":
      return "Signed out";
    default:
      return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

// ── Team Member Settings (simplified) ──────────────────

function TeamMemberSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/team/my-profile"],
    queryFn: () => api.get("/team/my-profile"),
  });

  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const startEdit = () => {
    setForm({ fullName: profile?.fullName || "", phone: user?.phone || "" });
    setEditing(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch("/team/my-profile", data),
    onSuccess: () => {
      toast({ title: "Profile updated" });
      queryClient.invalidateQueries({ queryKey: ["/team/my-profile"] });
      setEditing(false);
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const pwMutation = useMutation({
    mutationFn: (data: any) => api.patch("/team/my-profile", data),
    onSuccess: () => {
      toast({ title: "Password changed" });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const permissions: string[] = profile?.permissions || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">Team member account settings</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Profile Information</CardTitle>
            {!editing && <Button variant="outline" size="sm" onClick={startEdit}>Edit</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <>
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+971 50 000 0000" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">Name</p><p className="font-medium">{profile?.fullName || "—"}</p></div>
              <div><p className="text-muted-foreground">Email</p><p className="font-medium">{user?.email}</p></div>
              <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{user?.phone || "—"}</p></div>
              <div><p className="text-muted-foreground">Manager</p><p className="font-medium">{profile?.pmName || "—"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role & Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Role & Permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{profile?.roleName || "No Role Assigned"}</Badge>
          </div>
          {permissions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((p: string) => (
                <Badge key={p} variant="outline" className="text-[10px]">{p.replace(/\./g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No permissions assigned. Contact your Property Manager.</p>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <Input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} />
          </div>
          <Button
            disabled={!pwForm.currentPassword || !pwForm.newPassword || pwForm.newPassword !== pwForm.confirmPassword || pwMutation.isPending}
            onClick={() => pwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })}
          >
            {pwMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Change Password
          </Button>
          {pwForm.newPassword && pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
            <p className="text-xs text-destructive">Passwords don't match</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Settings (KYC users) ──────────────────────────

export default function GuestSettings() {
  const { user, refreshUser } = useAuth();

  // Team members get simplified settings
  if (user?.role === "PM_TEAM_MEMBER") return <TeamMemberSettings />;

  return <FullSettings />;
}

function FullSettings() {
  const [, navigate] = useLocation();
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [uploadPreviews, setUploadPreviews] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [highlightExpiry, setHighlightExpiry] = useState<string | null>(null);
  const passportFileRef = useRef<HTMLInputElement>(null);
  const tradeLicenseFileRef = useRef<HTMLInputElement>(null);

  // Fetch profile — response shape: { user: {...}, profile: {...} }
  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileResponse>({
    queryKey: ["/auth/me"],
    queryFn: () => api.get("/auth/me"),
  });

  // Fetch activity — server returns AuditEntry[] directly
  const { data: activityData, isLoading: activityLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/portal/activity"],
    queryFn: () => api.get("/portal/activity"),
  });

  // Subscription data (PM only)
  const isPM = profileData?.user?.role === "PROPERTY_MANAGER";
  const { data: subData } = useQuery<SubscriptionData>({
    queryKey: ["/subscriptions/current"],
    queryFn: () => api.get("/subscriptions/current"),
    enabled: isPM,
  });

  const { data: invoices = [] } = useQuery<InvoiceEntry[]>({
    queryKey: ["/subscriptions/invoices"],
    queryFn: async () => {
      const res = await api.get("/subscriptions/invoices");
      const list = res?.invoices ?? res;
      return Array.isArray(list) ? list : [];
    },
    enabled: isPM,
  });

  const { data: savedCard } = useQuery<{ cardBrand: string; cardLast4: string; cardHolderName: string } | null>({
    queryKey: ["/subscriptions/payment-method"],
    queryFn: () => api.get("/subscriptions/payment-method"),
    enabled: isPM,
  });

  // Cancel subscription mutation
  const cancelSub = useMutation({
    mutationFn: () => api.post("/subscriptions/cancel"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/current"] });
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/invoices"] });
      toast({ title: data.message || "Subscription cancelled" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Failed to cancel", variant: "destructive" });
    },
  });

  // Pay overdue invoice mutation
  const payInvoice = useMutation({
    mutationFn: (invoiceId: string) => api.post("/subscriptions/pay-invoice", { invoiceId }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/current"] });
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/invoices"] });
      toast({ title: data.message || "Invoice paid, subscription reactivated" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Payment failed", variant: "destructive" });
    },
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: (data: Record<string, string>) => api.patch("/portal/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/auth/me"] });
      refreshUser();
      setIsEditing(false);
      toast({ title: "Profile updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update profile", variant: "destructive" });
    },
  });

  // Change password mutation
  const changePassword = useMutation({
    mutationFn: (data: typeof passwordForm) => api.post("/portal/change-password", data),
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Password changed successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to change password", variant: "destructive" });
    },
  });

  const startEdit = () => {
    if (!profileData?.profile) return;
    const p = profileData.profile;
    const u = profileData.user;
    setEditForm({
      fullName: p.fullName || "",
      phone: u.phone || "",
      dob: p.dob || "",
      nationality: p.nationality || "",
      countryOfResidence: p.countryOfResidence || "",
      residentAddress: p.residentAddress || "",
      emiratesIdNumber: p.emiratesIdNumber || "",
      emiratesIdExpiry: p.emiratesIdExpiry || "",
      passportNumber: p.passportNumber || "",
      passportExpiry: p.passportExpiry || "",
      passportFrontUrl: p.passportFrontUrl || "",
      ...(u.role === "PROPERTY_MANAGER"
        ? {
            tradeLicenseExpiry: p.tradeLicenseExpiry || "",
            tradeLicenseUrl: p.tradeLicenseUrl || "",
            companyName: p.companyName || "",
            companyWebsite: p.companyWebsite || "",
            companyDescription: p.companyDescription || "",
            companyAddress: p.companyAddress || "",
          }
        : {}),
    });
    setUploadPreviews({});
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
    setUploadPreviews({});
    setUploadingField(null);
  };

  const handleFileUpload = async (file: File, urlField: string) => {
    const previewUrl = URL.createObjectURL(file);
    setUploadPreviews((prev) => ({ ...prev, [urlField]: previewUrl }));
    setUploadingField(urlField);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error);
      }
      const data = await res.json();
      setEditForm((prev) => ({ ...prev, [urlField]: data.url }));
      if (urlField === 'passportFrontUrl') {
        setHighlightExpiry('passportExpiry');
        toast({ title: "Document uploaded", description: "Don't forget to update the passport expiry date" });
      } else if (urlField === 'tradeLicenseUrl') {
        setHighlightExpiry('tradeLicenseExpiry');
        toast({ title: "Document uploaded", description: "Don't forget to update the trade license expiry date" });
      }
    } catch (error: any) {
      toast({ title: error.message || "Failed to upload file", variant: "destructive" });
      setUploadPreviews((prev) => {
        const next = { ...prev };
        delete next[urlField];
        return next;
      });
      setEditForm((prev) => ({ ...prev, [urlField]: "" }));
    } finally {
      setUploadingField(null);
    }
  };

  const saveProfile = () => {
    if (!editForm.fullName?.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    updateProfile.mutate(editForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast({ title: "Please fill in all password fields", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "New passwords do not match", variant: "destructive" });
      return;
    }
    changePassword.mutate(passwordForm);
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Failed to load profile data.
      </div>
    );
  }

  const user = profileData.user;
  const p = profileData.profile;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {/* ─── Document Expiry Warning Banner ─────────────────────────────── */}
      {(() => {
        if (!p) return null;
        const now = new Date();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;

        const docs: { name: string; expiry: string | null }[] = [
          { name: "Emirates ID", expiry: p.emiratesIdExpiry },
          { name: "Passport", expiry: p.passportExpiry },
          ...(user.role === "PROPERTY_MANAGER"
            ? [{ name: "Trade License", expiry: p.tradeLicenseExpiry }]
            : []),
        ];

        const warnings = docs
          .filter((d) => d.expiry)
          .map((d) => {
            const expiryDate = new Date(d.expiry!);
            const diffMs = expiryDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            return { name: d.name, expiryDate, diffMs, diffDays };
          })
          .filter((d) => d.diffMs <= thirtyDays);

        if (warnings.length === 0) return null;

        const hasExpired = warnings.some((w) => w.diffDays <= 0);

        return (
          <div
            className={`mb-6 rounded-lg border p-4 ${
              hasExpired
                ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle
                className={`h-5 w-5 ${
                  hasExpired
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              />
              <span
                className={`font-semibold ${
                  hasExpired
                    ? "text-red-800 dark:text-red-200"
                    : "text-amber-800 dark:text-amber-200"
                }`}
              >
                {hasExpired ? "Documents Expired / Expiring Soon" : "Documents Expiring Soon"}
              </span>
            </div>
            <ul className="space-y-1 ml-7">
              {warnings.map((w) => {
                const isExpired = w.diffDays <= 0;
                const formattedDate = w.expiryDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <li
                    key={w.name}
                    className={`text-sm flex items-center gap-2 ${
                      isExpired
                        ? "text-red-700 dark:text-red-300"
                        : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    <span>
                      {w.name} {isExpired ? "expired" : "expires"} on {formattedDate}{" "}
                      {isExpired
                        ? `(Expired ${Math.abs(w.diffDays)} day${Math.abs(w.diffDays) !== 1 ? "s" : ""} ago)`
                        : `(${w.diffDays} day${w.diffDays !== 1 ? "s" : ""} remaining)`}
                    </span>
                    <button
                      type="button"
                      onClick={startEdit}
                      className={`underline font-medium hover:opacity-80 ${
                        isExpired
                          ? "text-red-800 dark:text-red-200"
                          : "text-amber-800 dark:text-amber-200"
                      }`}
                    >
                      Update Now
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {user.role === "PROPERTY_MANAGER" && (
            <TabsTrigger value="billing">Plan & Billing</TabsTrigger>
          )}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ─── Profile Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Your profile details</CardDescription>
              </div>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveProfile}
                    disabled={updateProfile.isPending || uploadingField !== null}
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Full Name
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editForm.fullName || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, fullName: e.target.value }))
                      }
                    />
                  ) : (
                    <p className="font-medium">{p?.fullName || "—"}</p>
                  )}
                </div>

                {/* Email (read-only) */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </Label>
                  <p className="font-medium">{user.email}</p>
                </div>

                {/* Account Type (read-only) */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    Account Type
                  </Label>
                  <div>
                    <Badge variant="secondary">{ROLE_LABELS[user.role] || user.role}</Badge>
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </Label>
                  {isEditing ? (
                    <PhoneInput
                      value={editForm.phone || ""}
                      onChange={(v) =>
                        setEditForm((prev) => ({ ...prev, phone: v }))
                      }
                    />
                  ) : (
                    <p className="font-medium">{user.phone || "—"}</p>
                  )}
                </div>

                {/* Date of Birth */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Date of Birth
                  </Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editForm.dob || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, dob: e.target.value }))
                      }
                    />
                  ) : (
                    <p className="font-medium">{formatDate(p?.dob)}</p>
                  )}
                </div>

                {/* Nationality */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    Nationality
                  </Label>
                  {isEditing ? (
                    <Select
                      value={editForm.nationality || ""}
                      onValueChange={(v) =>
                        setEditForm((prev) => ({ ...prev, nationality: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{p?.nationality || "—"}</p>
                  )}
                </div>

                {/* Country of Residence */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Country of Residence
                  </Label>
                  {isEditing ? (
                    <Select
                      value={editForm.countryOfResidence || ""}
                      onValueChange={(v) =>
                        setEditForm((prev) => ({ ...prev, countryOfResidence: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{p?.countryOfResidence || "—"}</p>
                  )}
                </div>

                {/* Resident Address */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Resident Address
                  </Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.residentAddress || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, residentAddress: e.target.value }))
                      }
                      rows={2}
                    />
                  ) : (
                    <p className="font-medium">{p?.residentAddress || "—"}</p>
                  )}
                </div>

                <Separator className="md:col-span-2" />

                {/* Emirates ID Number */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5" />
                    Emirates ID Number
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editForm.emiratesIdNumber || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, emiratesIdNumber: e.target.value }))
                      }
                      placeholder="784-XXXX-XXXXXXX-X"
                    />
                  ) : (
                    <p className="font-medium">{p?.emiratesIdNumber || "—"}</p>
                  )}
                </div>

                {/* Emirates ID Expiry */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Emirates ID Expiry
                  </Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editForm.emiratesIdExpiry || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, emiratesIdExpiry: e.target.value }))
                      }
                    />
                  ) : (
                    <p className="font-medium">{formatDate(p?.emiratesIdExpiry)}</p>
                  )}
                </div>

                {/* Emirates ID Front */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Emirates ID — Front
                  </Label>
                  {p?.emiratesIdFrontUrl ? (
                    <div className="border rounded-lg overflow-hidden cursor-pointer" onClick={() => setLightbox({ src: p.emiratesIdFrontUrl, alt: "Emirates ID — Front" })}>
                      <img
                        src={p.emiratesIdFrontUrl}
                        alt="Emirates ID Front"
                        className="w-full h-32 object-cover hover:opacity-80 transition-opacity"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                      <p className="hidden text-xs text-muted-foreground p-2">Document uploaded</p>
                    </div>
                  ) : (
                    <p className="font-medium text-muted-foreground">Not uploaded</p>
                  )}
                </div>

                {/* Emirates ID Back */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Emirates ID — Back
                  </Label>
                  {p?.emiratesIdBackUrl ? (
                    <div className="border rounded-lg overflow-hidden cursor-pointer" onClick={() => setLightbox({ src: p.emiratesIdBackUrl, alt: "Emirates ID — Back" })}>
                      <img
                        src={p.emiratesIdBackUrl}
                        alt="Emirates ID Back"
                        className="w-full h-32 object-cover hover:opacity-80 transition-opacity"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                      <p className="hidden text-xs text-muted-foreground p-2">Document uploaded</p>
                    </div>
                  ) : (
                    <p className="font-medium text-muted-foreground">Not uploaded</p>
                  )}
                </div>

                <Separator className="md:col-span-2" />

                {/* Passport Number */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Passport Number
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editForm.passportNumber || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, passportNumber: e.target.value }))
                      }
                      placeholder="Enter passport number"
                    />
                  ) : (
                    <p className="font-medium">{p?.passportNumber || "—"}</p>
                  )}
                </div>

                {/* Passport Expiry */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Passport Expiry
                  </Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      className={highlightExpiry === 'passportExpiry' ? "ring-2 ring-amber-400 animate-pulse" : ""}
                      value={editForm.passportExpiry || ""}
                      onChange={(e) => {
                        setEditForm((prev) => ({ ...prev, passportExpiry: e.target.value }));
                        if (highlightExpiry === 'passportExpiry') setHighlightExpiry(null);
                      }}
                    />
                  ) : (
                    <p className="font-medium">{formatDate(p?.passportExpiry)}</p>
                  )}
                </div>

                {/* Passport Copy */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Passport Copy
                  </Label>
                  {isEditing ? (
                    <div className="space-y-2">
                      {(uploadPreviews.passportFrontUrl || editForm.passportFrontUrl) && (
                        <div className="border rounded-lg overflow-hidden w-fit">
                          <img
                            src={uploadPreviews.passportFrontUrl || editForm.passportFrontUrl}
                            alt="Passport"
                            className="h-32 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <input
                        ref={passportFileRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "passportFrontUrl");
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingField === "passportFrontUrl"}
                        onClick={() => passportFileRef.current?.click()}
                      >
                        {uploadingField === "passportFrontUrl" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {editForm.passportFrontUrl ? "Replace Passport Scan" : "Upload Passport Scan"}
                      </Button>
                    </div>
                  ) : p?.passportFrontUrl ? (
                    <div className="border rounded-lg overflow-hidden w-fit cursor-pointer" onClick={() => setLightbox({ src: p.passportFrontUrl, alt: "Passport" })}>
                      <img
                        src={p.passportFrontUrl}
                        alt="Passport"
                        className="h-32 object-cover hover:opacity-80 transition-opacity"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                      <p className="hidden text-xs text-muted-foreground p-2">Document uploaded</p>
                    </div>
                  ) : (
                    <p className="font-medium text-muted-foreground">Not uploaded</p>
                  )}
                </div>

                {/* Trade License (PM only) */}
                {user.role === "PROPERTY_MANAGER" && (
                  <>
                    <Separator className="md:col-span-2" />

                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        Trade License Expiry
                      </Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          className={highlightExpiry === 'tradeLicenseExpiry' ? "ring-2 ring-amber-400 animate-pulse" : ""}
                          value={editForm.tradeLicenseExpiry || ""}
                          onChange={(e) => {
                            setEditForm((prev) => ({ ...prev, tradeLicenseExpiry: e.target.value }));
                            if (highlightExpiry === 'tradeLicenseExpiry') setHighlightExpiry(null);
                          }}
                        />
                      ) : (
                        <p className="font-medium">{formatDate(p?.tradeLicenseExpiry)}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" />
                        Trade License Copy
                      </Label>
                      {isEditing ? (
                        <div className="space-y-2">
                          {(uploadPreviews.tradeLicenseUrl || editForm.tradeLicenseUrl) && (
                            <div className="border rounded-lg overflow-hidden w-fit">
                              <img
                                src={uploadPreviews.tradeLicenseUrl || editForm.tradeLicenseUrl}
                                alt="Trade License"
                                className="h-32 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                          )}
                          <input
                            ref={tradeLicenseFileRef}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, "tradeLicenseUrl");
                              e.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingField === "tradeLicenseUrl"}
                            onClick={() => tradeLicenseFileRef.current?.click()}
                          >
                            {uploadingField === "tradeLicenseUrl" ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {editForm.tradeLicenseUrl ? "Replace Trade License" : "Upload Trade License"}
                          </Button>
                        </div>
                      ) : p?.tradeLicenseUrl ? (
                        <div className="border rounded-lg overflow-hidden w-fit cursor-pointer" onClick={() => setLightbox({ src: p.tradeLicenseUrl, alt: "Trade License" })}>
                          <img
                            src={p.tradeLicenseUrl}
                            alt="Trade License"
                            className="h-32 object-cover hover:opacity-80 transition-opacity"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                            }}
                          />
                          <p className="hidden text-xs text-muted-foreground p-2">Document uploaded</p>
                        </div>
                      ) : (
                        <p className="font-medium text-muted-foreground">Not uploaded</p>
                      )}
                    </div>
                  </>
                )}

                <Separator className="md:col-span-2" />

                {/* KYC Status */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    KYC Status
                  </Label>
                  <div>
                    <Badge variant={kycBadgeProps(p?.kycStatus || "pending").variant} className={kycBadgeProps(p?.kycStatus || "pending").className}>
                      {kycBadgeProps(p?.kycStatus || "pending").label}
                    </Badge>
                  </div>
                </div>

                {/* Account Created */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Account Created
                  </Label>
                  <p className="font-medium">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Information (PM only) */}
          {user.role === "PROPERTY_MANAGER" && p && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      Company Name
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editForm.companyName || ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, companyName: e.target.value }))
                        }
                        placeholder="Enter company name"
                      />
                    ) : (
                      <p className="font-medium">{p.companyName || "—"}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      Company Website
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editForm.companyWebsite || ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, companyWebsite: e.target.value }))
                        }
                        placeholder="https://example.com"
                      />
                    ) : (
                      <p className="font-medium">{p.companyWebsite || "—"}</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Company Description
                    </Label>
                    {isEditing ? (
                      <Textarea
                        value={editForm.companyDescription || ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, companyDescription: e.target.value }))
                        }
                        placeholder="Describe your company"
                        rows={3}
                      />
                    ) : (
                      <p className="font-medium">{p.companyDescription || "—"}</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      Company Address
                    </Label>
                    {isEditing ? (
                      <Textarea
                        value={editForm.companyAddress || ""}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, companyAddress: e.target.value }))
                        }
                        placeholder="Enter company address"
                        rows={2}
                      />
                    ) : (
                      <p className="font-medium">{p.companyAddress || "—"}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <PasswordInput
                    id="currentPassword"
                    placeholder="Enter current password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <PasswordInput
                      id="newPassword"
                      placeholder="Enter new password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                    <PasswordInput
                      id="confirmNewPassword"
                      placeholder="Confirm new password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={changePassword.isPending}>
                  {changePassword.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Key className="h-4 w-4 mr-2" />
                  )}
                  Change Password
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* ─── Plan & Billing Tab (PM only) ────────────────────────────────── */}
        {user.role === "PROPERTY_MANAGER" && (
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Current Plan
                  </CardTitle>
                  <CardDescription>Your active subscription</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {(!subData || (subData.status !== "pending_payment" && subData.status !== "billing_suspended")) && (
                    <Button variant="outline" size="sm" onClick={() => navigate("/portal/plans")}>
                      Change Plan
                    </Button>
                  )}
                  {subData && subData.status !== "pending_payment" && subData.status !== "billing_suspended" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={cancelSub.isPending}
                      onClick={() => {
                        if (window.confirm("Are you sure you want to cancel your subscription? This cannot be undone.")) {
                          cancelSub.mutate();
                        }
                      }}
                    >
                      {cancelSub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {subData ? (
                  <div className="space-y-6">
                    {subData.status === "billing_suspended" && (
                      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-red-900">Account Suspended — Payment Overdue</p>
                          <p className="text-sm text-red-700 mb-3">
                            Your invoice for the <strong>{subData.planName}</strong> plan is overdue.
                            Please pay now to restore access to all features.
                          </p>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              // Find the failed/pending invoice and pay it
                              const overdueInvoice = invoices?.find((inv: any) => inv.status === "failed" || (inv.status === "pending" && inv.due_date && new Date(inv.due_date) < new Date()));
                              if (overdueInvoice) {
                                payInvoice.mutate(overdueInvoice.id);
                              }
                            }}
                            disabled={payInvoice.isPending}
                          >
                            {payInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                            Pay Now — AED {subData.planPrice}
                          </Button>
                        </div>
                      </div>
                    )}
                    {subData.status === "pending_payment" && (
                      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-amber-900">Payment Required</p>
                          <p className="text-sm text-amber-700 mb-3">
                            You've been assigned the <strong>{subData.planName}</strong> plan (AED {subData.planPrice}/{subData.planBillingCycle}).
                            Complete payment to activate your subscription and unlock all features.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/portal/checkout?planId=${subData.plan_id}&activate=true`)}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Complete Payment — AED {subData.planPrice}
                          </Button>
                        </div>
                      </div>
                    )}
                    {subData.inGracePeriod && (
                      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-red-900">Subscription expired — grace period active</p>
                          <p className="text-sm text-red-700">
                            Your billing period has ended. You have until <strong>{formatDate(subData.graceEndsAt)}</strong> to renew
                            before losing access to your plan features.
                          </p>
                        </div>
                      </div>
                    )}
                    {subData.status === "trial" && subData.trial_ends_at && (
                      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <Clock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-blue-900">You're on a free trial</p>
                          <p className="text-sm text-blue-700">
                            Your trial ends on <strong>{formatDate(subData.trial_ends_at)}</strong>.
                            After that, you'll be charged AED {subData.planPrice}/{subData.planBillingCycle}.
                            Cancel anytime before the trial ends to avoid being charged.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Plan</Label>
                        <p className="font-medium text-lg">{subData.planName}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Price</Label>
                        <p className="font-medium">AED {subData.planPrice} / {subData.planBillingCycle}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Status</Label>
                        <div>
                          <Badge variant={
                            subData.status === "active" ? "default" :
                            subData.status === "pending_payment" || subData.status === "billing_suspended" ? "destructive" :
                            "secondary"
                          }>
                            {subData.status === "pending_payment" ? "Payment Required" :
                             subData.status === "billing_suspended" ? "Suspended" :
                             subData.status.charAt(0).toUpperCase() + subData.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      {subData.status !== "pending_payment" && (
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Current Period</Label>
                          <p className="font-medium">
                            {formatDate(subData.current_period_start)} — {formatDate(subData.current_period_end)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">No active subscription</p>
                    <Button onClick={() => navigate("/portal/plans")}>Choose a Plan</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {savedCard && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Method
                  </CardTitle>
                  <CardDescription>Your saved card</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="h-10 w-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-md flex items-center justify-center text-white text-xs font-bold">
                      {savedCard.cardBrand}
                    </div>
                    <div>
                      <p className="font-medium">•••• •••• •••• {savedCard.cardLast4}</p>
                      <p className="text-sm text-muted-foreground">{savedCard.cardHolderName}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>Your past payments</CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground">No invoices yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Date</th>
                          <th className="text-left py-2 font-medium">Plan</th>
                          <th className="text-left py-2 font-medium">Amount</th>
                          <th className="text-left py-2 font-medium">Due Date</th>
                          <th className="text-left py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => {
                          const isOverdue = inv.due_date && inv.status !== "paid" && new Date(inv.due_date) < new Date();
                          return (
                            <tr key={inv.id} className="border-b last:border-0">
                              <td className="py-2">{formatDate(inv.created_at || inv.createdAt)}</td>
                              <td className="py-2">{inv.planName}</td>
                              <td className="py-2">AED {inv.amount}</td>
                              <td className={`py-2 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                                {inv.due_date ? formatDate(inv.due_date) : "—"}
                              </td>
                              <td className="py-2">
                                <Badge variant={
                                  inv.status === "paid" ? "default" :
                                  inv.status === "failed" ? "destructive" :
                                  "secondary"
                                }>
                                  {inv.status === "failed" ? "Overdue" :
                                   inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ─── Activity Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Your recent account activity</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !activityData?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No activity recorded yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activityData.map((entry, idx) => {
                    const Icon = getActionIcon(entry.action);
                    return (
                      <div key={entry.id}>
                        <div className="flex items-start gap-4 py-3">
                          <div className="mt-0.5 h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{getActionLabel(entry.action)}</p>
                            {entry.details && (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {entry.details}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDateTime(entry.createdAt)}
                              {entry.ipAddress && ` • ${entry.ipAddress}`}
                            </p>
                          </div>
                        </div>
                        {idx < activityData.length - 1 && <Separator />}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document image lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-medium text-sm">{lightbox.alt}</span>
              <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted" onClick={() => setLightbox(null)}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 flex justify-center bg-muted/30">
              <img
                src={lightbox.src}
                alt={lightbox.alt}
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
