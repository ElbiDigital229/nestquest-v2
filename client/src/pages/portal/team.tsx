import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PM_PERMISSIONS, PM_PERMISSION_LABELS } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Shield,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
  Mail,
  Phone,
  Activity,
  XCircle,
} from "lucide-react";

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  memberCount: number;
}

interface TeamMember {
  id: string;
  userId: string;
  roleId: string | null;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
  email: string;
  phone: string | null;
  userStatus: string;
  fullName: string | null;
  roleName: string | null;
  rolePermissions: string | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  invited: "bg-blue-100 text-blue-800",
  removed: "bg-red-100 text-red-800",
};

// Permission groups for cleaner UI
const PERMISSION_GROUPS = [
  { label: "Properties", keys: ["properties.view", "properties.create", "properties.edit", "properties.delete"] },
  { label: "Bookings", keys: ["bookings.view", "bookings.manage"] },
  { label: "Owners & Tenants", keys: ["owners.view", "owners.manage", "tenants.view", "tenants.manage"] },
  { label: "Financials", keys: ["financials.view", "financials.manage"] },
  { label: "Documents", keys: ["documents.view", "documents.manage"] },
  { label: "Administration", keys: ["team.manage", "billing.view", "billing.manage"] },
];

export default function TeamPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"members" | "roles">("members");

  // Role dialog
  const [roleDialog, setRoleDialog] = useState<{ mode: "create" | "edit"; role?: Role } | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [rolePerms, setRolePerms] = useState<string[]>([]);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");

  // Edit member dialog
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // Activity dialog
  const [activityUser, setActivityUser] = useState<TeamMember | null>(null);

  // Queries
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/team/roles"],
    queryFn: () => api.get("/team/roles"),
  });

  const { data: members = [] } = useQuery<TeamMember[]>({
    queryKey: ["/team/members"],
    queryFn: () => api.get("/team/members"),
  });

  const { data: activityData } = useQuery<{ propertyActivity: any[]; auditLog: any[] }>({
    queryKey: ["/team/activity", activityUser?.userId],
    queryFn: () => api.get(`/team/activity/${activityUser!.userId}`),
    enabled: !!activityUser,
  });

  // Mutations
  const saveRoleMutation = useMutation({
    mutationFn: (data: { id?: string; name: string; description: string; permissions: string[] }) => {
      if (data.id) return api.patch(`/team/roles/${data.id}`, data);
      return api.post("/team/roles", data);
    },
    onSuccess: () => {
      toast({ title: "Role saved" });
      queryClient.invalidateQueries({ queryKey: ["/team/roles"] });
      setRoleDialog(null);
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/team/roles/${id}`),
    onSuccess: () => {
      toast({ title: "Role deleted" });
      queryClient.invalidateQueries({ queryKey: ["/team/roles"] });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post("/team/members/invite", {
      email: inviteEmail, fullName: inviteName, phone: invitePhone || null, roleId: inviteRoleId || null,
    }),
    onSuccess: () => {
      toast({ title: "Team member added" });
      queryClient.invalidateQueries({ queryKey: ["/team/members"] });
      setInviteOpen(false);
      setInviteEmail(""); setInviteName(""); setInvitePhone(""); setInviteRoleId("");
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; roleId?: string; status?: string }) => api.patch(`/team/members/${id}`, data),
    onSuccess: () => {
      toast({ title: "Member updated" });
      queryClient.invalidateQueries({ queryKey: ["/team/members"] });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: () => {
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: ["/team/members"] });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const editMemberMutation = useMutation({
    mutationFn: (data: { id: string; fullName?: string; email?: string; phone?: string; roleId?: string; newPassword?: string }) => {
      const { id, ...body } = data;
      return api.patch(`/team/members/${id}`, body);
    },
    onSuccess: () => {
      toast({ title: "Member updated" });
      queryClient.invalidateQueries({ queryKey: ["/team/members"] });
      setEditMember(null);
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: () => api.post("/team/roles/seed-defaults", {}),
    onSuccess: (data: any) => {
      const count = data?.roles?.length ?? 0;
      toast({ title: count > 0 ? `${count} default role(s) loaded` : "Default roles already exist" });
      queryClient.invalidateQueries({ queryKey: ["/team/roles"] });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const openRoleDialog = (mode: "create" | "edit", role?: Role) => {
    setRoleName(role?.name || "");
    setRoleDesc(role?.description || "");
    setRolePerms(role?.permissions || []);
    setRoleDialog({ mode, role });
  };

  const togglePerm = (perm: string) => {
    setRolePerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const openEditMember = (m: TeamMember) => {
    setEditName(m.fullName || "");
    setEditEmail(m.email || "");
    setEditPhone(m.phone || "");
    setEditRoleId(m.roleId || "");
    setEditPassword("");
    setEditMember(m);
  };

  const activeMembers = members.filter(m => m.status !== "removed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Team Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage roles and team members</p>
        </div>
        <div className="flex gap-2">
          {tab === "roles" && (
            <>
              <Button variant="outline" onClick={() => seedDefaultsMutation.mutate()} disabled={seedDefaultsMutation.isPending}>
                {seedDefaultsMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Load Defaults
              </Button>
              <Button onClick={() => openRoleDialog("create")}>
                <Plus className="h-4 w-4 mr-1" /> New Role
              </Button>
            </>
          )}
          {tab === "members" && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Add Member
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === "members" ? "default" : "outline"} size="sm" onClick={() => setTab("members")}>
          <Users className="h-4 w-4 mr-1" /> Members ({activeMembers.length})
        </Button>
        <Button variant={tab === "roles" ? "default" : "outline"} size="sm" onClick={() => setTab("roles")}>
          <Shield className="h-4 w-4 mr-1" /> Roles ({roles.length})
        </Button>
      </div>

      {/* Members Tab */}
      {tab === "members" && (
        <Card>
          <CardContent className="p-0">
            {activeMembers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No team members yet. Add your first member to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b text-left">
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">Contact</th>
                      <th className="px-4 py-2.5 font-medium">Role</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Joined</th>
                      <th className="px-4 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMembers.map((m) => (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium">
                          <button className="hover:underline text-left" onClick={() => openEditMember(m)}>
                            {m.fullName || "—"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {m.email}</p>
                          {m.phone && <p className="flex items-center gap-1 text-muted-foreground text-xs"><Phone className="h-3 w-3" /> {m.phone}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={m.roleId || "none"}
                            onValueChange={(v) => updateMemberMutation.mutate({ id: m.id, roleId: v === "none" ? undefined : v })}
                          >
                            <SelectTrigger className="w-40 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Role</SelectItem>
                              {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] border-0 ${STATUS_STYLES[m.status] || ""}`}>
                            {m.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(m.acceptedAt || m.invitedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMember(m)} title="Edit member">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActivityUser(m)} title="View activity">
                              <Activity className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMemberMutation.mutate(m.id)} title="Remove">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Roles Tab */}
      {tab === "roles" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="text-center py-12 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No roles created yet. Create a role to assign permissions to team members.</p>
              </CardContent>
            </Card>
          ) : (
            roles.map((role) => (
              <Card key={role.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{role.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openRoleDialog("edit", role)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRoleMutation.mutate(role.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">{role.memberCount} member(s)</p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <Badge key={p} variant="secondary" className="text-[10px]">
                        {(PM_PERMISSION_LABELS as any)[p] || p}
                      </Badge>
                    ))}
                    {role.permissions.length === 0 && <span className="text-xs text-muted-foreground">No permissions</span>}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Role Create/Edit Dialog */}
      <Dialog open={!!roleDialog} onOpenChange={(open) => !open && setRoleDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{roleDialog?.mode === "edit" ? "Edit Role" : "Create Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role Name</Label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. General Manager" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} placeholder="e.g. Full access to all operations" />
            </div>
            <Separator />
            <div>
              <Label className="mb-3 block">Permissions</Label>
              <div className="space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{group.label}</p>
                    <div className="space-y-2">
                      {group.keys.map((perm) => (
                        <div key={perm} className="flex items-center justify-between">
                          <span className="text-sm">{(PM_PERMISSION_LABELS as any)[perm] || perm}</span>
                          <Switch checked={rolePerms.includes(perm)} onCheckedChange={() => togglePerm(perm)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)}>Cancel</Button>
            <Button
              disabled={saveRoleMutation.isPending || !roleName.trim()}
              onClick={() => saveRoleMutation.mutate({
                id: roleDialog?.role?.id,
                name: roleName,
                description: roleDesc,
                permissions: rolePerms,
              })}
            >
              {saveRoleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {roleDialog?.mode === "edit" ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="e.g. John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="e.g. john@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="+971 50 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Assign Role <span className="text-destructive">*</span></Label>
              <Select value={inviteRoleId || "none"} onValueChange={(v) => setInviteRoleId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Select a role...</SelectItem>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              The team member will be created with a temporary password: <strong>Welcome1!</strong>
              <br />They can change it after logging in.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              disabled={inviteMutation.isPending || !inviteEmail.trim() || !inviteName.trim() || !inviteRoleId}
              onClick={() => inviteMutation.mutate()}
            >
              {inviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+971 50 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={editRoleId || "none"} onValueChange={(v) => setEditRoleId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Role</SelectItem>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label>Reset Password</Label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
              />
              <p className="text-xs text-muted-foreground">Only fill this if you want to change the member's password.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button
              disabled={editMemberMutation.isPending}
              onClick={() => editMember && editMemberMutation.mutate({
                id: editMember.id,
                fullName: editName,
                email: editEmail,
                phone: editPhone,
                roleId: editRoleId || undefined,
                newPassword: editPassword || undefined,
              })}
            >
              {editMemberMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={!!activityUser} onOpenChange={(open) => !open && setActivityUser(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity — {activityUser?.fullName}</DialogTitle>
          </DialogHeader>
          {activityData ? (
            <div className="space-y-4">
              {activityData.propertyActivity.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Property Actions</h4>
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {activityData.propertyActivity.map((a: any) => (
                      <div key={a.id} className="px-3 py-2 text-sm flex justify-between">
                        <div>
                          <p>{a.description}</p>
                          <p className="text-xs text-muted-foreground">{a.propertyName}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activityData.auditLog.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Account Actions</h4>
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {activityData.auditLog.map((a: any) => (
                      <div key={a.id} className="px-3 py-2 text-sm flex justify-between">
                        <div>
                          <Badge variant="outline" className="text-[10px] mr-2">{a.action}</Badge>
                          {a.details}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activityData.propertyActivity.length === 0 && activityData.auditLog.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">No activity recorded yet.</p>
              )}
            </div>
          ) : (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
