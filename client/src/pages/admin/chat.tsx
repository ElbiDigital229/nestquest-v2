import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/role-utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Send,
  Loader2,
  Search,
  User,
  Plus,
} from "lucide-react";

interface Conversation {
  guestId: string;
  fullName: string;
  email: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  userRole?: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface ChatUser {
  guestId: string;
  fullName: string;
  email: string;
  userRole: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminChat() {
  const queryClient = useQueryClient();
  // Auto-select user from query param (e.g., navigating from user detail page)
  const initialUserId = new URLSearchParams(window.location.search).get("user");
  const [selectedId, setSelectedId] = useState<string | null>(initialUserId);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Conversation list — poll every 5s
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/chat/conversations"],
    queryFn: () => api.get("/chat/conversations"),
    refetchInterval: 5000,
  });

  // All portal users for "New Conversation" dialog and header fallback
  const { data: allUsers = [] } = useQuery<ChatUser[]>({
    queryKey: ["/chat/users"],
    queryFn: () => api.get("/chat/users"),
    enabled: showNewChat || !!initialUserId,
  });

  const filteredUsers = allUsers.filter(
    (u) =>
      !newChatSearch ||
      u.fullName?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(newChatSearch.toLowerCase())
  );

  const handleStartChat = (guestId: string) => {
    setSelectedId(guestId);
    setShowNewChat(false);
    setNewChatSearch("");
  };

  const filtered = conversations.filter(
    (c) =>
      !search ||
      c.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const selected = conversations.find((c) => c.guestId === selectedId)
    || (selectedId ? (() => {
      const u = allUsers.find((u) => u.guestId === selectedId);
      return u ? { guestId: u.guestId, fullName: u.fullName, email: u.email, lastMessage: null, lastMessageAt: null, unreadCount: 0, userRole: u.userRole } as Conversation : undefined;
    })() : undefined);

  // Messages for selected conversation — poll every 3s
  const { data: msgs = [] } = useQuery<Message[]>({
    queryKey: ["/chat/messages", selectedId],
    queryFn: () => api.get(`/chat/${selectedId}/messages`),
    enabled: !!selectedId,
    refetchInterval: 3000,
  });

  // Mark as read when conversation opens
  useEffect(() => {
    if (!selectedId) return;
    api.patch(`/chat/${selectedId}/read`, {}).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["/chat/conversations"] });
  }, [selectedId, msgs.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Send message
  const sendMsg = useMutation({
    mutationFn: () => api.post(`/chat/${selectedId}/messages`, { content: input.trim() }),
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["/chat/messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["/chat/conversations"] });
    },
  });

  const handleSend = () => {
    if (!input.trim() || !selectedId || sendMsg.isPending) return;
    sendMsg.mutate();
  };

  return (
    <div className="flex h-full bg-white dark:bg-card shadow-sm border-l border-r">
      {/* ── Conversation list ── */}
      <div className="w-72 shrink-0 border-r flex flex-col">
        <div className="p-3 border-b space-y-2">
          <Button
            size="sm"
            className="w-full"
            onClick={() => setShowNewChat(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search users…"
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No conversations yet
            </div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.guestId}
                onClick={() => setSelectedId(conv.guestId)}
                className={cn(
                  "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b last:border-0",
                  selectedId === conv.guestId
                    ? "bg-accent"
                    : "hover:bg-accent/50"
                )}
              >
                <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {initials(conv.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium truncate">{conv.fullName}</p>
                    {conv.lastMessageAt && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[conv.userRole || ""] || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[160px]">
                    {conv.lastMessage
                      ? conv.lastMessage.length > 30
                        ? conv.lastMessage.slice(0, 30) + "…"
                        : conv.lastMessage
                      : "No messages yet"}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <Badge className="h-5 min-w-5 p-0 flex items-center justify-center text-xs shrink-0">
                    {conv.unreadCount}
                  </Badge>
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* ── Message thread ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-12 w-12 opacity-30" />
            <p className="text-sm">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-5 py-3 border-b flex items-center gap-3 shrink-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {initials(selected?.fullName || "")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium leading-none">{selected?.fullName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selected?.email}</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-5 py-4">
              {msgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 py-16">
                  <User className="h-8 w-8 opacity-30" />
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {msgs.map((msg) => {
                    const isAdmin = msg.senderRole === "SUPER_ADMIN";
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex gap-2", isAdmin ? "flex-row-reverse" : "flex-row")}
                      >
                        <Avatar className="h-7 w-7 shrink-0 mt-1">
                          <AvatarFallback className={cn("text-xs", isAdmin ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                            {isAdmin ? "SA" : initials(selected?.fullName || "")}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn("max-w-[70%]", isAdmin ? "items-end" : "items-start", "flex flex-col gap-1")}>
                          <div
                            className={cn(
                              "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                              isAdmin
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-muted rounded-tl-sm"
                            )}
                          >
                            {msg.content}
                          </div>
                          <span className="text-xs text-muted-foreground px-1">
                            {formatTime(msg.createdAt)}
                            {isAdmin && msg.readAt && " · Read"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t shrink-0">
              <form
                className="flex gap-2"
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              >
                <Input
                  placeholder="Type a message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1"
                  autoComplete="off"
                />
                <Button type="submit" size="icon" disabled={!input.trim() || sendMsg.isPending}>
                  {sendMsg.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>Select a user to start a conversation with.</DialogDescription>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              className="pl-8"
              value={newChatSearch}
              onChange={(e) => setNewChatSearch(e.target.value)}
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-72">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No users found
              </div>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map((u) => (
                  <button
                    key={u.guestId}
                    onClick={() => handleStartChat(u.guestId)}
                    className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent flex items-center gap-3 transition-colors"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {initials(u.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {ROLE_LABELS[u.userRole] || u.userRole}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
