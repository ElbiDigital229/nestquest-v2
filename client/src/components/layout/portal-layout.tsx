import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  MessageSquare,
  Bell,
  Users,
  CreditCard,
  Building,
  SprayCan,
  ClipboardCheck,
  Star,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  FileText,
  BarChart3,
  Handshake,
  XCircle,
  DollarSign,
  Contact,
  TrendingUp,
  Mail,
  KeyRound,
} from "lucide-react";
import NotificationBell from "@/components/notification-bell";

type NavItem = { label: string; href: string; icon: any; permission?: string };

// Base nav items — role-aware labels
function getBaseNavItems(role: string): NavItem[] {
  if (role === "CLEANER") {
    return [
      { label: "My Tasks", href: "/portal/cleaner-tasks", icon: ClipboardCheck },
      { label: "Notifications", href: "/portal/notifications", icon: Bell },
      { label: "Settings", href: "/portal/settings", icon: Settings },
    ];
  }
  return [
    { label: "Settings", href: "/portal/settings", icon: Settings },
    { label: role === "PM_TEAM_MEMBER" ? "Bookings" : "My Bookings", href: "/portal/my-bookings", icon: CalendarDays },
    { label: "Messages", href: "/portal/messages", icon: MessageSquare },
    { label: "Notifications", href: "/portal/notifications", icon: Bell },
  ];
}

const roleNavItems: Record<string, NavItem[]> = {
  PROPERTY_MANAGER: [
    { label: "Documents", href: "/portal/documents", icon: FileText },
    { label: "Property Owners", href: "/portal/property-owners", icon: Users },
    { label: "Tenants", href: "/portal/tenants", icon: Users },
    { label: "Settlements", href: "/portal/settlements", icon: Handshake },
    { label: "Team", href: "/portal/team", icon: Users },
    { label: "My Reports", href: "/portal/reports", icon: BarChart3 },
  ],
  PROPERTY_OWNER: [
    { label: "My Properties", href: "/portal/po-properties", icon: Home },
    { label: "Documents", href: "/portal/documents", icon: FileText },
    { label: "Reviews", href: "/portal/my-reviews", icon: Star },
    { label: "Settlements", href: "/portal/settlements", icon: Handshake },
    { label: "My Reports", href: "/portal/po-reports", icon: BarChart3 },
    { label: "Property Managers", href: "/portal/property-managers", icon: Users },
  ],
  PM_TEAM_MEMBER: [
    { label: "Documents", href: "/portal/documents", icon: FileText, permission: "documents.view" },
    { label: "Settlements", href: "/portal/settlements", icon: Handshake, permission: "financials.view" },
    { label: "My Reports", href: "/portal/reports", icon: BarChart3, permission: "financials.view" },
  ],
  CLEANER: [],
  TENANT: [
    { label: "Property Managers", href: "/portal/property-managers", icon: Users },
  ],
};

// ST sub-nav items — permission field controls visibility for team members
// PM (PROPERTY_MANAGER) always sees all items; permission is only checked for PM_TEAM_MEMBER
const stNavItems: NavItem[] = [
  { label: "ST Properties", href: "/portal/st-properties", icon: Home, permission: "properties.view" },
  { label: "Calendar", href: "/portal/calendar", icon: CalendarDays, permission: "bookings.view" },
  { label: "Pricing", href: "/portal/st-pricing", icon: DollarSign, permission: "properties.edit" },
  { label: "Analytics", href: "/portal/st-analytics", icon: TrendingUp, permission: "financials.view" },
  { label: "Guests", href: "/portal/st-guests", icon: Contact, permission: "bookings.view" },
  { label: "Reviews", href: "/portal/st-reviews", icon: Star, permission: "bookings.view" },
  { label: "Cancellations", href: "/portal/st-cancellations", icon: XCircle, permission: "bookings.view" },
  { label: "Msg Templates", href: "/portal/st-message-templates", icon: Mail, permission: "team.manage" },
  { label: "Smart Locks", href: "/portal/st-smart-locks", icon: KeyRound, permission: "properties.edit" },
];

// Cleaner ops sub-nav
const cleanerOpsItems: NavItem[] = [
  { label: "Cleaner Ops", href: "/portal/cleaner-ops", icon: SprayCan },
];

export default function PortalLayout({ children, fullWidth }: { children: React.ReactNode; fullWidth?: boolean }) {
  const { user, logout, hasPermission } = useAuth();
  const isTeamMember = user?.role === "PM_TEAM_MEMBER";
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stSectionOpen, setStSectionOpen] = useState(true);

  // Pending PM-link requests for PROPERTY_OWNER / TENANT — drives sidebar badge
  const showsLinkBadge = user?.role === "PROPERTY_OWNER" || user?.role === "TENANT";
  const { data: linkItems = [] } = useQuery<Array<{ status: string }>>({
    queryKey: ["/links", "sidebar-pending"],
    queryFn: () => api.get("/links"),
    enabled: showsLinkBadge,
    refetchInterval: 60_000,
  });
  const pendingLinkCount = linkItems.filter((l) => l.status === "pending").length;

  // For team members, filter nav items and ST sub-items by their permissions
  const visibleRoleNavItems = (roleNavItems[user?.role ?? ""] ?? []).filter(
    item => !isTeamMember || !item.permission || hasPermission(item.permission)
  );
  const visibleStNavItems = isTeamMember
    ? stNavItems.filter(item => !item.permission || hasPermission(item.permission))
    : stNavItems;

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "G";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / Brand */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border">
          <Link href="/portal/settings" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Home className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-sidebar-foreground">NestQuest</span>
          </Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-1">
            {[...getBaseNavItems(user?.role || ""), ...visibleRoleNavItems].map((item) => {
              const isActive = location === item.href;
              const showBadge =
                showsLinkBadge &&
                item.href === "/portal/property-managers" &&
                pendingLinkCount > 0;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold">
                        {pendingLinkCount > 99 ? "99+" : pendingLinkCount}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}

            {/* Short Term collapsible section — PM always; team members only if they can see at least one item */}
            {(user?.role === "PROPERTY_MANAGER" || (user?.role === "PM_TEAM_MEMBER" && visibleStNavItems.length > 0)) && (
              <>
                <div className="pt-2">
                  <button
                    onClick={() => setStSectionOpen(!stSectionOpen)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent/50"
                  >
                    <Building className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">Short Term</span>
                    {stSectionOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                </div>
                {stSectionOpen &&
                  visibleStNavItems.map((item) => {
                    const isActive = location === item.href || location.startsWith(item.href + "/");
                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={cn(
                            "flex items-center gap-3 pl-10 pr-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                          )}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </div>
                      </Link>
                    );
                  })}
              </>
            )}

            {/* Cleaner Ops — PM always; team members only with cleaners.manage */}
            {(user?.role === "PROPERTY_MANAGER" || (user?.role === "PM_TEAM_MEMBER" && hasPermission("cleaners.manage"))) && (
              <Link href="/portal/cleaner-ops">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer mt-1",
                    location.startsWith("/portal/cleaner-ops")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <SprayCan className="h-4 w-4 shrink-0" />
                  Cleaner Ops
                </div>
              </Link>
            )}
          </nav>
        </ScrollArea>

        {/* Logout */}
        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center h-14 px-4 border-b lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 font-semibold">NestQuest</span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex items-center justify-end h-14 px-6 border-b shrink-0">
          <NotificationBell />
        </header>

        {/* Page content */}
        {fullWidth ? (
          <div className="flex-1 overflow-hidden">{children}</div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="container max-w-6xl mx-auto p-6">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
