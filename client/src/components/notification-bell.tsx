import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Link2,
  MessageSquare,
  UserPlus,
  Check,
  X,
  AlertCircle,
} from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function typeIcon(type: string) {
  switch (type) {
    case "NEW_MESSAGE":
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case "LINK_INVITE":
      return <UserPlus className="h-4 w-4 text-purple-500" />;
    case "LINK_ACCEPTED":
      return <Check className="h-4 w-4 text-emerald-500" />;
    case "LINK_REJECTED":
      return <X className="h-4 w-4 text-red-500" />;
    case "LINK_REMOVED":
      return <Link2 className="h-4 w-4 text-orange-500" />;
    case "USER_SIGNUP":
      return <UserPlus className="h-4 w-4 text-emerald-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/notifications/unread-count"],
    queryFn: () => api.get("/notifications/unread-count"),
    refetchInterval: 30000,
  });

  const { data: recent = [] } = useQuery<NotificationItem[]>({
    queryKey: ["/notifications", "recent"],
    queryFn: async () => {
      const res = await api.get("/notifications?limit=5");
      return res.notifications ?? res;
    },
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/notifications/unread-count"] });
    },
  });

  const unreadCount = countData?.count || 0;
  const notificationsPath = user?.role === "SUPER_ADMIN" ? "/admin/notifications" : "/portal/notifications";

  const handleClick = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
    if (n.linkUrl) setLocation(n.linkUrl);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No notifications yet
            </div>
          ) : (
            recent.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent transition-colors border-b last:border-0",
                  !n.isRead && "bg-accent/30"
                )}
              >
                <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm truncate", !n.isRead && "font-semibold")}>{n.title}</p>
                  {n.body && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                )}
              </button>
            ))
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-sm"
            onClick={() => {
              setOpen(false);
              setLocation(notificationsPath);
            }}
          >
            View All Notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
