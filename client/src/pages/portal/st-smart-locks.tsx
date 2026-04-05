import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Key, Plus, Trash2, Loader2, Building2, MapPin, Hash,
} from "lucide-react";

const LOCK_BRANDS = ["Schlage", "Yale", "August", "Nuki", "Igloohome", "TTLock", "Samsung", "Other"];
const LOCK_LOCATIONS = ["Front Door", "Back Door", "Gate", "Garage", "Safe Box", "Other"];

const EMPTY_FORM = { propertyId: "", name: "", brand: "", model: "", deviceId: "", location: "", apiKey: "" };

export default function StSmartLocks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<"locks" | "pins">("locks");

  // All locks across PM's properties
  const { data: locks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/st-locks"],
    queryFn: () => api.get("/st-locks"),
  });

  // All PIN history across PM's properties
  const { data: pins = [], isLoading: pinsLoading } = useQuery<any[]>({
    queryKey: ["/st-locks/pins"],
    queryFn: () => api.get("/st-locks/pins"),
    enabled: activeTab === "pins",
  });

  // All properties for the dropdown
  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ["/st-properties"],
    queryFn: () => api.get("/st-properties"),
  });

  const addMut = useMutation({
    mutationFn: () => api.post("/st-locks", form),
    onSuccess: () => {
      toast({ title: "Lock added" });
      queryClient.invalidateQueries({ queryKey: ["/st-locks"] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ lockId, isActive }: { lockId: string; isActive: boolean }) =>
      api.patch(`/st-locks/${lockId}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/st-locks"] }),
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (lockId: string) => api.delete(`/st-locks/${lockId}`),
    onSuccess: () => {
      toast({ title: "Lock removed" });
      queryClient.invalidateQueries({ queryKey: ["/st-locks"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // Group locks by property
  const grouped = locks.reduce((acc: Record<string, { name: string; address: string; locks: any[] }>, lock: any) => {
    if (!acc[lock.propertyId]) {
      acc[lock.propertyId] = { name: lock.propertyName, address: lock.propertyAddress, locks: [] };
    }
    acc[lock.propertyId].locks.push(lock);
    return acc;
  }, {});

  const activeLocks = locks.filter((l: any) => l.isActive).length;
  const totalPins = locks.reduce((sum: number, l: any) => sum + (l.activePins || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" />
            Smart Locks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage access locks and PIN codes across all your properties
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Lock
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Locks</p>
            <p className="text-2xl font-bold mt-1">{locks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Locks</p>
            <p className="text-2xl font-bold mt-1 text-green-700">{activeLocks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active PINs</p>
            <p className="text-2xl font-bold mt-1 text-blue-700">{totalPins}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["locks", "pins"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "locks" ? "Locks" : "PIN History"}
          </button>
        ))}
      </div>

      {/* Locks tab */}
      {activeTab === "locks" && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : locks.length === 0 ? (
            <div className="text-center py-20 border rounded-lg">
              <Key className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No smart locks configured</p>
              <p className="text-xs text-muted-foreground mt-1">Add a lock to auto-generate PINs for guests.</p>
              <Button className="mt-4" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add First Lock
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([propId, group]) => (
                <div key={propId}>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{group.name}</span>
                    {group.address && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{group.address}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs ml-auto">
                      {group.locks.length} lock{group.locks.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {group.locks.map((lock: any) => (
                      <Card key={lock.id} className={cn(!lock.isActive && "opacity-60")}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                                {lock.name}
                                <Badge className={cn("text-[10px] border-0 shrink-0", lock.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
                                  {lock.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </p>
                              <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                                {lock.brand && <p>{lock.brand}{lock.model ? ` — ${lock.model}` : ""}</p>}
                                {lock.deviceId && (
                                  <p className="flex items-center gap-1">
                                    <Hash className="h-3 w-3" />
                                    <span className="font-mono">{lock.deviceId}</span>
                                  </p>
                                )}
                                {lock.location && (
                                  <p className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />{lock.location}
                                  </p>
                                )}
                                <p className="text-blue-600 font-medium">{lock.activePins} active PIN{lock.activePins !== 1 ? "s" : ""}</p>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title={lock.isActive ? "Deactivate" : "Activate"}
                                onClick={() => toggleMut.mutate({ lockId: lock.id, isActive: !lock.isActive })}
                                disabled={toggleMut.isPending}
                              >
                                {lock.isActive ? <span className="text-xs">⏸</span> : <span className="text-xs">▶</span>}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteMut.mutate(lock.id)}
                                disabled={deleteMut.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Separator className="mt-6" />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PIN History tab */}
      {activeTab === "pins" && (
        <>
          {pinsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pins.length === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <Key className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No PIN history yet.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-2 font-medium">PIN</th>
                    <th className="px-4 py-2 font-medium">Property / Lock</th>
                    <th className="px-4 py-2 font-medium">Guest</th>
                    <th className="px-4 py-2 font-medium">Valid From</th>
                    <th className="px-4 py-2 font-medium">Valid Until</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pins.map((p: any) => (
                    <tr key={p.id} className="border-t hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-base">{p.pin}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-xs">{p.propertyName}</p>
                        <p className="text-muted-foreground text-xs">{p.lockName}{p.lockLocation ? ` · ${p.lockLocation}` : ""}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p>{p.guestName}</p>
                        {p.checkIn && <p className="text-xs text-muted-foreground">{p.checkIn?.slice(0, 10)} – {p.checkOut?.slice(0, 10)}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {p.validFrom ? new Date(p.validFrom).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {p.validUntil ? new Date(p.validUntil).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={cn("text-[10px] border-0", p.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
                          {p.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add Lock Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Smart Lock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Property <span className="text-destructive">*</span></Label>
              <select
                value={form.propertyId}
                onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                <option value="">Select property...</option>
                {properties.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.publicName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Lock Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Front Door Lock"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <select
                  value={form.brand}
                  onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {LOCK_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. Encode Plus"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Device ID</Label>
              <Input
                value={form.deviceId}
                onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}
                placeholder="e.g. SCHLAGE-MG1-2304"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <select
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {LOCK_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>API Key <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={form.apiKey}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="For future lock API integration"
                type="password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.name.trim() || !form.propertyId || addMut.isPending}
              onClick={() => addMut.mutate()}
            >
              {addMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
