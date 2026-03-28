import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Plus, Mail, Phone, Calendar, MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import LinkedUserDetailDialog from "@/components/linked-user-detail-dialog";

interface LinkItem {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  targetName: string;
  targetEmail: string;
  targetPhone: string;
}

function initials(name: string): string {
  return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [viewLinkId, setViewLinkId] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery<LinkItem[]>({
    queryKey: ["/links", "TENANT"],
    queryFn: () => api.get("/links?targetRole=TENANT"),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post("/links/invite", { email: email.trim(), targetRole: "TENANT" }),
    onSuccess: () => {
      toast({ title: "Invite sent", description: "Tenant will be notified" });
      setShowInvite(false);
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["/links"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const accepted = links.filter((l) => l.status === "accepted");
  const pending = links.filter((l) => l.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your linked Tenants</p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Send Invite
        </Button>
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Pending Invites</h2>
          <div className="grid gap-3">
            {pending.map((link) => (
              <Card key={link.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-amber-100 text-amber-700 text-sm">
                      {initials(link.targetName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{link.targetName}</p>
                    <p className="text-xs text-muted-foreground">{link.targetEmail}</p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Linked Tenants ({accepted.length})
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : accepted.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 opacity-30 mb-3" />
              <p className="text-sm">No linked Tenants yet</p>
              <p className="text-xs mt-1">Send an invite to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {accepted.map((link) => (
              <Card
                key={link.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setViewLinkId(link.id)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {initials(link.targetName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{link.targetName}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {link.targetEmail}
                      </span>
                      {link.targetPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {link.targetPhone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Linked {formatDate(link.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-primary"
                    onClick={(e) => { e.stopPropagation(); navigate(`/portal/messages?dm=${link.id}`); }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-transparent">Linked</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Send Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Tenant</DialogTitle>
            <DialogDescription>Enter the email of the Tenant you want to link with.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) inviteMutation.mutate();
            }}
            className="space-y-4"
          >
            <Input
              placeholder="tenant@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setShowInvite(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!email.trim() || inviteMutation.isPending}>
                {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Send Invite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Full Profile Detail Dialog */}
      <LinkedUserDetailDialog
        linkId={viewLinkId}
        open={!!viewLinkId}
        onClose={() => setViewLinkId(null)}
      />
    </div>
  );
}
