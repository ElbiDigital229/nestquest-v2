import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Plus, Users, ClipboardList, Zap, CheckCircle, Clock, Trash2, UserPlus,
} from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
};

export default function CleanerOps() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"cleaners" | "assignments" | "checklists" | "rules">("cleaners");

  // Dialogs
  const [createCleanerOpen, setCreateCleanerOpen] = useState(false);
  const [createChecklistOpen, setCreateChecklistOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createRuleOpen, setCreateRuleOpen] = useState(false);

  // Forms
  const [cleanerForm, setCleanerForm] = useState({ email: "", fullName: "", phone: "", password: "" });
  const [checklistForm, setChecklistForm] = useState({ name: "", propertyId: "", items: [""] });
  const [taskForm, setTaskForm] = useState({ propertyId: "", cleanerUserId: "", checklistId: "", title: "", notes: "", priority: "normal", dueAt: "" });
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [ruleForm, setRuleForm] = useState({ propertyId: "", checklistId: "", delayMinutes: "30" });

  // Queries
  const { data: cleaners = [] } = useQuery<any[]>({ queryKey: ["/cleaners"], queryFn: () => api.get("/cleaners") });
  const { data: checklists = [] } = useQuery<any[]>({ queryKey: ["/cleaners/checklists"], queryFn: () => api.get("/cleaners/checklists") });
  const { data: tasks = [] } = useQuery<any[]>({ queryKey: ["/cleaners/tasks"], queryFn: () => api.get("/cleaners/tasks") });
  const { data: rules = [] } = useQuery<any[]>({ queryKey: ["/cleaners/automation-rules"], queryFn: () => api.get("/cleaners/automation-rules") });
  const { data: properties = [] } = useQuery<any[]>({ queryKey: ["/st-properties"], queryFn: () => api.get("/st-properties") });

  // Mutations
  const createCleanerMut = useMutation({
    mutationFn: () => api.post("/cleaners", cleanerForm),
    onSuccess: () => { toast({ title: "Cleaner created" }); queryClient.invalidateQueries({ queryKey: ["/cleaners"] }); setCreateCleanerOpen(false); setCleanerForm({ email: "", fullName: "", phone: "", password: "" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const createChecklistMut = useMutation({
    mutationFn: () => api.post("/cleaners/checklists", { ...checklistForm, items: checklistForm.items.filter(i => i.trim()) }),
    onSuccess: () => { toast({ title: "Checklist created" }); queryClient.invalidateQueries({ queryKey: ["/cleaners/checklists"] }); setCreateChecklistOpen(false); setChecklistForm({ name: "", propertyId: "", items: [""] }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const createTaskMut = useMutation({
    mutationFn: () => api.post("/cleaners/tasks", { ...taskForm, dueAt: taskForm.dueAt || null, customItems: customItems.filter(i => i.trim()) }),
    onSuccess: () => { toast({ title: "Task assigned" }); queryClient.invalidateQueries({ queryKey: ["/cleaners/tasks"] }); setCreateTaskOpen(false); setTaskForm({ propertyId: "", cleanerUserId: "", checklistId: "", title: "", notes: "", priority: "normal", dueAt: "" }); setCustomItems([]); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const createRuleMut = useMutation({
    mutationFn: () => api.post("/cleaners/automation-rules", { ...ruleForm, delayMinutes: parseInt(ruleForm.delayMinutes) }),
    onSuccess: () => { toast({ title: "Rule created" }); queryClient.invalidateQueries({ queryKey: ["/cleaners/automation-rules"] }); setCreateRuleOpen(false); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleRuleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/cleaners/automation-rules/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/cleaners/automation-rules"] }),
  });

  const deleteRuleMut = useMutation({
    mutationFn: (id: string) => api.delete(`/cleaners/automation-rules/${id}`),
    onSuccess: () => { toast({ title: "Rule deleted" }); queryClient.invalidateQueries({ queryKey: ["/cleaners/automation-rules"] }); },
  });

  const deleteChecklistMut = useMutation({
    mutationFn: (id: string) => api.delete(`/cleaners/checklists/${id}`),
    onSuccess: () => { toast({ title: "Checklist deleted" }); queryClient.invalidateQueries({ queryKey: ["/cleaners/checklists"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cleaner Operations</h1>
          <p className="text-muted-foreground mt-1">Manage cleaners, tasks, and automation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([["cleaners", "Cleaners", Users], ["assignments", "Assignments", ClipboardList], ["checklists", "Checklists", CheckCircle], ["rules", "Automation", Zap]] as [string, string, any][]).map(([key, label, Icon]) => (
          <Button key={key} variant={tab === key ? "default" : "outline"} size="sm" onClick={() => setTab(key as any)}>
            <Icon className="h-4 w-4 mr-1" /> {label}
          </Button>
        ))}
      </div>

      {/* ── CLEANERS TAB ── */}
      {tab === "cleaners" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Cleaner Accounts</CardTitle>
            <Button size="sm" onClick={() => setCreateCleanerOpen(true)}><UserPlus className="h-4 w-4 mr-1" /> Add Cleaner</Button>
          </CardHeader>
          <CardContent>
            {cleaners.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No cleaners yet. Add your first cleaner.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50 border-b"><th className="px-4 py-2.5 text-left font-medium">Email</th><th className="px-4 py-2.5 text-left font-medium">Phone</th><th className="px-4 py-2.5 text-center font-medium">Tasks</th><th className="px-4 py-2.5 text-center font-medium">Completed</th><th className="px-4 py-2.5 text-left font-medium">Status</th><th className="px-4 py-2.5 text-left font-medium">Action</th></tr></thead>
                  <tbody>
                    {cleaners.map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5">{c.email}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.phone || "—"}</td>
                        <td className="px-4 py-2.5 text-center">{c.taskCount}</td>
                        <td className="px-4 py-2.5 text-center">{c.completedCount}</td>
                        <td className="px-4 py-2.5"><Badge className={`text-[10px] border-0 ${c.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{c.status}</Badge></td>
                        <td className="px-4 py-2.5">
                          <Button
                            variant={c.status === "active" ? "destructive" : "default"}
                            size="sm"
                            onClick={async () => {
                              const newStatus = c.status === "active" ? "suspended" : "active";
                              await api.patch(`/cleaners/${c.id}/status`, { status: newStatus });
                              queryClient.invalidateQueries({ queryKey: ["/cleaners"] });
                              toast({ title: `Cleaner ${newStatus === "active" ? "activated" : "deactivated"}` });
                            }}
                          >
                            {c.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
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

      {/* ── ASSIGNMENTS TAB ── */}
      {tab === "assignments" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Cleaning Assignments</CardTitle>
            <Button size="sm" onClick={() => setCreateTaskOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Task</Button>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No tasks yet.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50 border-b"><th className="px-4 py-2.5 text-left font-medium">Task</th><th className="px-4 py-2.5 text-left font-medium">Property</th><th className="px-4 py-2.5 text-left font-medium">Cleaner</th><th className="px-4 py-2.5 text-center font-medium">Progress</th><th className="px-4 py-2.5 text-left font-medium">Status</th><th className="px-4 py-2.5 text-left font-medium">Due</th></tr></thead>
                  <tbody>
                    {tasks.map((t: any) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2.5 font-medium">{t.title}</td>
                        <td className="px-4 py-2.5"><p>{t.propertyName}</p><p className="text-xs text-muted-foreground">{t.buildingName} {t.unitNumber ? `Unit ${t.unitNumber}` : ""}</p></td>
                        <td className="px-4 py-2.5 text-muted-foreground">{t.cleanerEmail || "Unassigned"}</td>
                        <td className="px-4 py-2.5 text-center">{t.checkedItems}/{t.totalItems}</td>
                        <td className="px-4 py-2.5"><Badge className={`text-[10px] border-0 ${STATUS_STYLES[t.status] || ""}`}>{t.status.replace(/_/g, " ")}</Badge></td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(t.dueAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── CHECKLISTS TAB ── */}
      {tab === "checklists" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Cleaning Checklists</CardTitle>
            <Button size="sm" onClick={() => { setChecklistForm({ name: "", propertyId: "", items: [""] }); setCreateChecklistOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Checklist</Button>
          </CardHeader>
          <CardContent>
            {checklists.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No checklists yet. Create one to use with tasks.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {checklists.map((c: any) => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.propertyName || "All properties"}</p>
                          <p className="text-xs text-muted-foreground mt-1">{c.itemCount} items</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteChecklistMut.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── AUTOMATION TAB ── */}
      {tab === "rules" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Automation Rules</CardTitle>
            <Button size="sm" onClick={() => { setRuleForm({ propertyId: "", checklistId: "", delayMinutes: "30" }); setCreateRuleOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Rule</Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">Auto-create cleaning tasks when a guest checks out of a property.</p>
            {rules.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No automation rules yet.</p>
            ) : (
              <div className="space-y-3">
                {rules.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between border rounded-lg p-4">
                    <div>
                      <p className="font-medium">{r.propertyName}</p>
                      <p className="text-sm text-muted-foreground">Checklist: {r.checklistName} | Delay: {r.delayMinutes} min</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={r.isActive} onCheckedChange={(v) => toggleRuleMut.mutate({ id: r.id, isActive: v })} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRuleMut.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── CREATE CLEANER DIALOG ── */}
      <Dialog open={createCleanerOpen} onOpenChange={setCreateCleanerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Cleaner</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Full Name <span className="text-destructive">*</span></Label><Input value={cleanerForm.fullName} onChange={e => setCleanerForm(f => ({ ...f, fullName: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email <span className="text-destructive">*</span></Label><Input type="email" value={cleanerForm.email} onChange={e => setCleanerForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={cleanerForm.phone} onChange={e => setCleanerForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Password <span className="text-destructive">*</span></Label><Input type="password" value={cleanerForm.password} onChange={e => setCleanerForm(f => ({ ...f, password: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCleanerOpen(false)}>Cancel</Button>
            <Button disabled={createCleanerMut.isPending || !cleanerForm.email || !cleanerForm.fullName || !cleanerForm.password} onClick={() => createCleanerMut.mutate()}>
              {createCleanerMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE CHECKLIST DIALOG ── */}
      <Dialog open={createChecklistOpen} onOpenChange={setCreateChecklistOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Checklist</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Checklist Name <span className="text-destructive">*</span></Label><Input value={checklistForm.name} onChange={e => setChecklistForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard Turnover Clean" /></div>
            <div className="space-y-1.5">
              <Label>Property (optional)</Label>
              <Select value={checklistForm.propertyId || "all"} onValueChange={v => setChecklistForm(f => ({ ...f, propertyId: v === "all" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.publicName || p.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Checklist Items <span className="text-destructive">*</span></Label>
              {checklistForm.items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={item} onChange={e => { const items = [...checklistForm.items]; items[i] = e.target.value; setChecklistForm(f => ({ ...f, items })); }} placeholder={`Item ${i + 1}`} />
                  {checklistForm.items.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-destructive" onClick={() => setChecklistForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setChecklistForm(f => ({ ...f, items: [...f.items, ""] }))}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateChecklistOpen(false)}>Cancel</Button>
            <Button disabled={createChecklistMut.isPending || !checklistForm.name || !checklistForm.items.some(i => i.trim())} onClick={() => createChecklistMut.mutate()}>
              {createChecklistMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE TASK DIALOG ── */}
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Cleaning Task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Title <span className="text-destructive">*</span></Label><Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Deep clean before check-in" /></div>
            <div className="space-y-1.5">
              <Label>Property <span className="text-destructive">*</span></Label>
              <Select value={taskForm.propertyId} onValueChange={v => setTaskForm(f => ({ ...f, propertyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select property..." /></SelectTrigger>
                <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.publicName || p.id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cleaner <span className="text-destructive">*</span></Label>
              <Select value={taskForm.cleanerUserId} onValueChange={v => setTaskForm(f => ({ ...f, cleanerUserId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select cleaner..." /></SelectTrigger>
                <SelectContent>{cleaners.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground">TASK ITEMS — use a checklist template, add custom items, or both</p>
            <div className="space-y-1.5">
              <Label>Checklist Template</Label>
              <Select value={taskForm.checklistId || "none"} onValueChange={v => setTaskForm(f => ({ ...f, checklistId: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No checklist</SelectItem>
                  {checklists.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.itemCount} items)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Custom Items</Label>
              {customItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={item} onChange={e => { const items = [...customItems]; items[i] = e.target.value; setCustomItems(items); }} placeholder={`Item ${i + 1}`} />
                  <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-destructive" onClick={() => setCustomItems(customItems.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCustomItems([...customItems, ""])}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label>Due Date <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" value={taskForm.dueAt} onChange={e => setTaskForm(f => ({ ...f, dueAt: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={taskForm.notes} onChange={e => setTaskForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
            <Button disabled={createTaskMut.isPending || !taskForm.title || !taskForm.propertyId || !taskForm.cleanerUserId || !taskForm.dueAt} onClick={() => createTaskMut.mutate()}>
              {createTaskMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE RULE DIALOG ── */}
      <Dialog open={createRuleOpen} onOpenChange={setCreateRuleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Automation Rule</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Automatically create a cleaning task when a guest checks out.</p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Property <span className="text-destructive">*</span></Label>
              <Select value={ruleForm.propertyId} onValueChange={v => setRuleForm(f => ({ ...f, propertyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select property..." /></SelectTrigger>
                <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.publicName || p.id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Checklist <span className="text-destructive">*</span></Label>
              <Select value={ruleForm.checklistId} onValueChange={v => setRuleForm(f => ({ ...f, checklistId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select checklist..." /></SelectTrigger>
                <SelectContent>{checklists.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Delay after checkout</Label>
              <Select value={ruleForm.delayMinutes} onValueChange={v => setRuleForm(f => ({ ...f, delayMinutes: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRuleOpen(false)}>Cancel</Button>
            <Button disabled={createRuleMut.isPending || !ruleForm.propertyId || !ruleForm.checklistId} onClick={() => createRuleMut.mutate()}>
              {createRuleMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
