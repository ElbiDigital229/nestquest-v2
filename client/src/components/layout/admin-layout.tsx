import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  LogOut,
  Menu,
  X,
  Shield,
  LayoutDashboard,
  MessageSquare,
  Bell,
  ClipboardCheck,
  CreditCard,
  Receipt,
} from "lucide-react";
import NotificationBell from "@/components/notification-bell";

type NavGroup = { kind: "group"; label: string; icon: any; children: { label: string; href: string }[] };
type NavLink = { kind: "link"; label: string; icon: any; href: string };
type NavItem = NavGroup | NavLink;

const navItems: NavItem[] = [
  {
    kind: "link",
    label: "Users",
    icon: Users,
    href: "/admin/users",
  },
  {
    kind: "link",
    label: "Messages",
    icon: MessageSquare,
    href: "/admin/messages/chat",
  },
  {
    kind: "link",
    label: "Plans",
    icon: CreditCard,
    href: "/admin/plans",
  },
  {
    kind: "link",
    label: "Transactions",
    icon: Receipt,
    href: "/admin/transactions",
  },
  {
    kind: "link",
    label: "Compliance",
    icon: ClipboardCheck,
    href: "/admin/compliance",
  },
  {
    kind: "link",
    label: "Notifications",
    icon: Bell,
    href: "/admin/notifications",
  },
];

export default function AdminLayout({ children, fullWidth }: { children: React.ReactNode; fullWidth?: boolean }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Users"]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/admin/login";
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

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
          <Link href="/admin" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-sidebar-foreground">NestQuest Admin</span>
          </Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Admin info */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-destructive/10 text-destructive text-sm font-medium">
                SA
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">Super Admin</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-1">
            {navItems.map((item) => {
              if (item.kind === "link") {
                const isActive = location.startsWith(item.href);
                return (
                  <Link key={item.label} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </div>
                  </Link>
                );
              }

              const group = item;
              const isExpanded = expandedGroups.includes(group.label);
              const hasActiveChild = group.children.some((c) => location.startsWith(c.href));

              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      hasActiveChild
                        ? "text-sidebar-foreground"
                        : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <group.icon className="h-4 w-4 shrink-0" />
                    {group.label}
                    <svg
                      className={cn("ml-auto h-4 w-4 transition-transform", isExpanded && "rotate-90")}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 pl-3 border-l border-sidebar-border space-y-1 mt-1">
                      {group.children.map((child) => {
                        const isActive = location.startsWith(child.href);
                        return (
                          <Link key={child.href} href={child.href}>
                            <div
                              className={cn(
                                "px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                                isActive
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                              )}
                              onClick={() => setSidebarOpen(false)}
                            >
                              {child.label}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
          <span className="ml-3 font-semibold">NestQuest Admin</span>
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
            <div className="container max-w-7xl mx-auto p-6">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
