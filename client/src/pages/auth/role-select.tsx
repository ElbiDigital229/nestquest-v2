import { useLocation, Redirect } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { roleToSlug } from "@/lib/role-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Building2, KeyRound, Users, Shield } from "lucide-react";

const ROLES = [
  { key: "GUEST", label: "Guest", description: "Book and manage your stays", icon: Home, color: "bg-blue-500" },
  { key: "PROPERTY_MANAGER", label: "Property Manager", description: "Manage properties and bookings", icon: Building2, color: "bg-emerald-500" },
  { key: "PROPERTY_OWNER", label: "Property Owner", description: "List and monitor your properties", icon: KeyRound, color: "bg-amber-500" },
  { key: "TENANT", label: "Tenant", description: "Manage your rental experience", icon: Users, color: "bg-purple-500" },
];

export default function RoleSelect() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  if (user) {
    return <Redirect to={user.role === "SUPER_ADMIN" ? "/admin" : "/portal/settings"} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mx-auto mb-6 h-14 w-14 rounded-xl bg-primary flex items-center justify-center">
        <Home className="h-7 w-7 text-primary-foreground" />
      </div>
      <h1 className="text-3xl font-bold mb-1">NestQuest</h1>
      <p className="text-muted-foreground mb-8">Choose how you'd like to sign in</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
        {ROLES.map((role) => (
          <Card
            key={role.key}
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
            onClick={() => navigate(`/login/${roleToSlug(role.key)}`)}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`h-11 w-11 rounded-xl ${role.color} flex items-center justify-center shrink-0`}>
                <role.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">{role.label}</p>
                <p className="text-xs text-muted-foreground">{role.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <a href="/admin/login" className="text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Admin Access
        </a>
      </p>
    </div>
  );
}
