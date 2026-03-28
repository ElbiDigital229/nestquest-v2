import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Link2,
  MessageSquare,
  UserPlus,
  Check,
  X,
  AlertCircle,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function typeIcon(type: string) {
  switch (type) {
    case "NEW_MESSAGE": return <MessageSquare className="h-5 w-5 text-blue-500" />;
    case "LINK_INVITE": return <UserPlus className="h-5 w-5 text-purple-500" />;
    case "LINK_ACCEPTED": return <Check className="h-5 w-5 text-emerald-500" />;
    case "LINK_REJECTED": return <X className="h-5 w-5 text-red-500" />;
    case "LINK_REMOVED": return <Link2 className="h-5 w-5 text-orange-500" />;
    case "USER_SIGNUP": return <UserPlus className="h-5 w-5 text-emerald-500" />;
    default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  }
}

export default function AdminNotifications() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: items = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["/notifications", filter],
    queryFn: async () => {
      const res = await api.get(`/notifications?limit=50&type=${filter}`);
      return res.notifications ?? res;
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/notifications"] });
    },
  });

  const handleClick = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.linkUrl) setLocation(n.linkUrl);
  };

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm">No notifications</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {items.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "cursor-pointer transition-colors hover:bg-accent/50",
                !n.isRead && "border-l-4 border-l-blue-500"
              )}
              onClick={() => handleClick(n)}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", !n.isRead && "font-semibold")}>{n.title}</p>
                  {n.body && (
                    <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 mt-1" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
