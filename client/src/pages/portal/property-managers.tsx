import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Mail,
  Phone,
  Calendar,
  Eye,
  Check,
  X,
  Building2,
  Loader2,
  Unlink,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LinkItem {
  id: string;
  pmUserId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pmName: string;
  pmEmail: string;
  pmPhone: string;
}

interface PmDetails {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  propertiesManaged: number;
}

function initials(name: string): string {
  return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PropertyManagersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [viewLinkId, setViewLinkId] = useState<string | null>(null);
  const [viewLinkedPmId, setViewLinkedPmId] = useState<string | null>(null);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery<LinkItem[]>({
    queryKey: ["/links", "pm-view"],
    queryFn: () => api.get("/links"),
  });

  const activeLinkId = viewLinkId || viewLinkedPmId;

  const { data: pmDetails } = useQuery<PmDetails>({
    queryKey: ["/links/details", activeLinkId],
    queryFn: () => api.get(`/links/${activeLinkId}/details`),
    enabled: !!activeLinkId,
  });

  const respondMutation = useMutation({
    mutationFn: ({ linkId, action }: { linkId: string; action: string }) =>
      api.patch(`/links/${linkId}/respond`, { action }),
    onSuccess: (_, vars) => {
      toast({
        title: vars.action === "accept" ? "Invite accepted" : "Invite declined",
        description: vars.action === "accept" ? "You are now linked" : "The invite has been declined",
      });
      setViewLinkId(null);
      queryClient.invalidateQueries({ queryKey: ["/links"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) => api.delete(`/links/${linkId}`),
    onSuccess: () => {
      toast({ title: "Unlinked", description: "You have been unlinked from this Property Manager" });
      setViewLinkedPmId(null);
      setConfirmUnlinkId(null);
      queryClient.invalidateQueries({ queryKey: ["/links"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const pending = links.filter((l) => l.status === "pending");
  const accepted = links.filter((l) => l.status === "accepted");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Property Managers</h1>
        <p className="text-sm text-muted-foreground mt-1">View your linked Property Managers and pending requests</p>
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Pending Requests ({pending.length})
          </h2>
          <div className="grid gap-3">
            {pending.map((link) => (
              <Card key={link.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-sm">
                      {initials(link.pmName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{link.pmName}</p>
                    <p className="text-xs text-muted-foreground">{link.pmEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewLinkId(link.id)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => respondMutation.mutate({ linkId: link.id, action: "accept" })}
                      disabled={respondMutation.isPending}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => respondMutation.mutate({ linkId: link.id, action: "reject" })}
                      disabled={respondMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Linked Managers */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Linked Property Managers ({accepted.length})
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : accepted.length === 0 && pending.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 opacity-30 mb-3" />
              <p className="text-sm">No linked Property Managers yet</p>
              <p className="text-xs mt-1">When a Property Manager invites you, it will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {accepted.map((link) => (
              <Card
                key={link.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setViewLinkedPmId(link.id)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {initials(link.pmName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{link.pmName}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {link.pmEmail}
                      </span>
                      {link.pmPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {link.pmPhone}
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

      {/* Pending PM Details Dialog */}
      <Dialog open={!!viewLinkId} onOpenChange={() => setViewLinkId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Property Manager Details</DialogTitle>
            <DialogDescription>Review details before accepting the invite.</DialogDescription>
          </DialogHeader>
          {pmDetails && viewLinkId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {initials(pmDetails.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{pmDetails.fullName}</p>
                  <p className="text-sm text-muted-foreground">Property Manager</p>
                </div>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{pmDetails.email}</span>
                </div>
                {pmDetails.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{pmDetails.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{pmDetails.propertiesManaged} properties managed</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Member since {formatDate(pmDetails.createdAt)}</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="destructive"
                  onClick={() => respondMutation.mutate({ linkId: viewLinkId, action: "reject" })}
                  disabled={respondMutation.isPending}
                >
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button
                  onClick={() => respondMutation.mutate({ linkId: viewLinkId, action: "accept" })}
                  disabled={respondMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-1" /> Accept
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Linked PM Details Dialog */}
      <Dialog open={!!viewLinkedPmId} onOpenChange={() => { setViewLinkedPmId(null); setConfirmUnlinkId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Property Manager Details</DialogTitle>
            <DialogDescription>View linked Property Manager info.</DialogDescription>
          </DialogHeader>
          {pmDetails && viewLinkedPmId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {initials(pmDetails.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{pmDetails.fullName}</p>
                  <p className="text-sm text-muted-foreground">Property Manager</p>
                </div>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{pmDetails.email}</span>
                </div>
                {pmDetails.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{pmDetails.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{pmDetails.propertiesManaged} properties managed</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Member since {formatDate(pmDetails.createdAt)}</span>
                </div>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                {confirmUnlinkId === viewLinkedPmId ? (
                  <div className="flex items-center gap-2 w-full">
                    <p className="text-sm text-muted-foreground flex-1">Confirm unlink?</p>
                    <Button size="sm" variant="outline" onClick={() => setConfirmUnlinkId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => unlinkMutation.mutate(viewLinkedPmId)}
                      disabled={unlinkMutation.isPending}
                    >
                      {unlinkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Unlink className="h-3.5 w-3.5 mr-1" />}
                      Confirm
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmUnlinkId(viewLinkedPmId)}
                    >
                      <Unlink className="h-3.5 w-3.5 mr-1" /> Unlink
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setViewLinkedPmId(null);
                        navigate(`/portal/messages?dm=${viewLinkedPmId}`);
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Message
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
