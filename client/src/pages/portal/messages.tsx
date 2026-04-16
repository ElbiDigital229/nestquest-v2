import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/role-utils";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, MessageSquare } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminConversation {
  type: "admin";
  id: string; // guestId
  name: string;
  email: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface DmConversation {
  type: "dm";
  id: string; // linkId
  name: string;
  email: string;
  role: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface GuestConversation {
  type: "guest";
  id: string; // guestId (users.id)
  name: string;
  email: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface PoGuestConversation {
  type: "po-guest";
  id: string; // guestId (users.id)
  name: string;
  email: string;
  propertyName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

type ConvoItem = AdminConversation | DmConversation | GuestConversation | PoGuestConversation;

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface GuestProfile {
  user: { id: string; email: string };
  profile: { id: string; fullName: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "G";
}

function getSearchParam(key: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuestMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConvo, setSelectedConvo] = useState<ConvoItem | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const dmParam = useRef(getSearchParam("dm"));

  // Get own profile to get guestId
  const { data: profileData } = useQuery<GuestProfile>({
    queryKey: ["/auth/me"],
    queryFn: () => api.get("/auth/me"),
  });

  const myName = profileData?.profile?.fullName || user?.name || "Guest";

  // Admin support conversations
  const { data: adminConvos = [] } = useQuery<any[]>({
    queryKey: ["/chat/conversations"],
    queryFn: () => api.get("/chat/conversations"),
    refetchInterval: 5000,
  });

  // DM conversations
  const { data: dmConvos = [] } = useQuery<any[]>({
    queryKey: ["/chat/dm/conversations"],
    queryFn: () => api.get("/chat/dm/conversations"),
    refetchInterval: 5000,
  });

  // PM guest conversations (only for PM / PM_TEAM_MEMBER)
  const isPm = user?.role === "PROPERTY_MANAGER" || user?.role === "PM_TEAM_MEMBER";
  const isPo = user?.role === "PROPERTY_OWNER";
  const { data: guestConvos = [] } = useQuery<any[]>({
    queryKey: ["/chat/guest-conversations"],
    queryFn: () => api.get("/chat/guest-conversations"),
    enabled: isPm,
    refetchInterval: 5000,
  });

  // PO guest conversations (only for PROPERTY_OWNER)
  const { data: poGuestConvos = [] } = useQuery<any[]>({
    queryKey: ["/chat/po-guest-conversations"],
    queryFn: () => api.get("/chat/po-guest-conversations"),
    enabled: isPo,
    refetchInterval: 5000,
  });

  // Merge conversations
  const allConversations: ConvoItem[] = [
    ...adminConvos.map((c: any): AdminConversation => ({
      type: "admin",
      id: c.guestId,
      name: c.fullName || "NestQuest Support",
      email: c.email || "",
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount || 0,
    })),
    ...dmConvos.map((c: any): DmConversation => ({
      type: "dm",
      id: c.linkId,
      name: c.otherName || "User",
      email: c.otherEmail || "",
      role: c.otherRole || "",
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount || 0,
    })),
    ...guestConvos.map((c: any): GuestConversation => ({
      type: "guest",
      id: c.guestId,
      name: c.guestName || "Guest",
      email: c.guestEmail || "",
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount || 0,
    })),
    ...poGuestConvos.map((c: any): PoGuestConversation => ({
      type: "po-guest",
      id: c.guestId,
      name: c.guestName || "Guest",
      email: c.guestEmail || "",
      propertyName: c.propertyName || "",
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount || 0,
    })),
  ].sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  // Auto-select: prefer dm param, then first conversation
  useEffect(() => {
    if (selectedConvo) return;
    if (dmParam.current) {
      // Find or create a placeholder DM conversation
      const existing = allConversations.find((c) => c.type === "dm" && c.id === dmParam.current);
      if (existing) {
        setSelectedConvo(existing);
      } else {
        // DM with no messages yet — create a temporary entry
        // We need the other user's info from the DM conversations list
        const dmFromList = dmConvos.find((c: any) => c.linkId === dmParam.current);
        if (dmFromList) {
          setSelectedConvo({
            type: "dm",
            id: dmParam.current!,
            name: dmFromList.otherName || "User",
            email: dmFromList.otherEmail || "",
            role: dmFromList.otherRole || "",
            lastMessage: null,
            lastMessageAt: null,
            unreadCount: 0,
          });
        } else if (dmConvos.length >= 0) {
          // DM conversations loaded but link not found — might be a new convo with no messages
          // Still set it so we can send the first message
          setSelectedConvo({
            type: "dm",
            id: dmParam.current!,
            name: "Loading...",
            email: "",
            role: "",
            lastMessage: null,
            lastMessageAt: null,
            unreadCount: 0,
          });
        }
      }
      dmParam.current = null;
      return;
    }
    if (allConversations.length > 0) {
      setSelectedConvo(allConversations[0]);
    }
  }, [allConversations.length, dmConvos.length]);

  // Update selected convo data when refreshed
  useEffect(() => {
    if (!selectedConvo) return;
    const updated = allConversations.find((c) => c.type === selectedConvo.type && c.id === selectedConvo.id);
    if (updated && updated.name !== selectedConvo.name) {
      setSelectedConvo(updated);
    }
  }, [allConversations]);

  const isDm = selectedConvo?.type === "dm";
  const isGuest = selectedConvo?.type === "guest" || selectedConvo?.type === "po-guest";
  const convoId = selectedConvo?.id;

  const msgQueryKey = isDm ? "/chat/dm/messages" : "/chat/messages";
  const msgEndpoint = isDm
    ? `/chat/dm/${convoId}/messages`
    : `/chat/${convoId}/messages`;

  // Messages — poll every 3s
  const { data: msgs = [], isLoading } = useQuery<Message[]>({
    queryKey: [msgQueryKey, convoId],
    queryFn: () => api.get(msgEndpoint),
    enabled: !!convoId,
    refetchInterval: 3000,
  });

  // Mark as read
  useEffect(() => {
    if (!convoId || msgs.length === 0) return;
    const endpoint = isDm ? `/chat/dm/${convoId}/read` : `/chat/${convoId}/read`;
    api.patch(endpoint, {}).catch(() => {});
  }, [convoId, msgs.length, isDm]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Send message
  const sendMsg = useMutation({
    mutationFn: () => api.post(msgEndpoint, { content: input.trim() }),
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: [msgQueryKey, convoId] });
      queryClient.invalidateQueries({ queryKey: ["/chat/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/chat/dm/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/chat/guest-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/chat/po-guest-conversations"] });
    },
  });

  const handleSend = () => {
    if (!input.trim() || !convoId || sendMsg.isPending) return;
    sendMsg.mutate();
  };

  return (
    <div className="flex h-full bg-white dark:bg-card shadow-sm border-l border-r">
      {/* ── Conversation list ── */}
      <div className="w-72 shrink-0 border-r flex flex-col">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold">Conversations</p>
        </div>

        <ScrollArea className="flex-1">
          {allConversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No conversations yet
            </div>
          ) : (
            allConversations.map((conv) => {
              const isSelected = selectedConvo?.type === conv.type && selectedConvo?.id === conv.id;
              const isAdmin = conv.type === "admin";
              return (
                <button
                  key={`${conv.type}-${conv.id}`}
                  onClick={() => setSelectedConvo(conv)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b last:border-0",
                    isSelected ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                    <AvatarFallback className={cn(
                      "text-xs font-semibold",
                      isAdmin ? "bg-destructive/10 text-destructive"
                        : conv.type === "guest" ? "bg-green-100 text-green-700"
                        : conv.type === "po-guest" ? "bg-orange-100 text-orange-700"
                        : "bg-primary/10 text-primary"
                    )}>
                      {isAdmin ? "SA" : getInitials(conv.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-medium truncate">{conv.name}</p>
                      {conv.lastMessageAt && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.type === "guest" ? "Guest · " : ""}
                      {conv.type === "po-guest" ? `${(conv as PoGuestConversation).propertyName} · ` : ""}
                      {conv.type === "dm" && (conv as DmConversation).role
                        ? ((ROLE_LABELS as any)[(conv as DmConversation).role] || (conv as DmConversation).role) + (conv.lastMessage ? " · " : "")
                        : ""}
                      {conv.lastMessage || (isAdmin ? "No messages yet" : "Start a conversation")}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 p-0 flex items-center justify-center text-xs shrink-0">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* ── Message thread ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConvo ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="h-12 w-12 opacity-30" />
            <p className="text-sm">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-5 py-3 border-b flex items-center gap-3 shrink-0 bg-muted/20">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={cn(
                  "text-xs font-semibold",
                  isDm ? "bg-primary/10 text-primary"
                    : isGuest ? "bg-green-100 text-green-700"
                    : "bg-destructive/10 text-destructive"
                )}>
                  {selectedConvo.type === "admin" ? "SA" : getInitials(selectedConvo.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium leading-none">{selectedConvo.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isDm
                    ? (ROLE_LABELS as any)[(selectedConvo as DmConversation).role] || "Linked User"
                    : isGuest
                    ? "Guest"
                    : "Typically replies within a few hours"}
                </p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-5 py-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : msgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                  <MessageSquare className="h-10 w-10 opacity-30" />
                  <div className="text-center">
                    <p className="text-sm font-medium">No messages yet</p>
                    <p className="text-xs mt-1">
                      {isDm ? `Send a message to ${selectedConvo.name}` : "Send a message to start the conversation with support"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {msgs.map((msg) => {
                    const isMe = msg.senderId === user?.id || msg.senderId === profileData?.user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}
                      >
                        {!isMe && (
                          <Avatar className="h-7 w-7 shrink-0 mt-1">
                            <AvatarFallback className={cn(
                              "text-xs",
                              isDm ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                            )}>
                              {isDm ? getInitials(selectedConvo.name) : "SA"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("max-w-[70%] flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
                          <div
                            className={cn(
                              "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                              isMe
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-muted rounded-tl-sm"
                            )}
                          >
                            {msg.content}
                          </div>
                          <span className="text-xs text-muted-foreground px-1">
                            {formatTime(msg.createdAt)}
                            {isMe && msg.readAt && " · Read"}
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
                <Button type="submit" size="icon" disabled={!input.trim() || !convoId || sendMsg.isPending}>
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
    </div>
  );
}
