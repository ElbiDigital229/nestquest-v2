import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreditCard, Plus, Pencil, Trash2, Loader2, Users, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";

interface PlanFeature {
  id?: string;
  featureKey: string;
  limitType: string;
  booleanValue: boolean | null;
  numericMin: number | null;
  numericMax: number | null;
}

interface Subscriber {
  email: string;
  fullName: string;
  status: string;
  trialEndsAt: string | null;
  guestId: string;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: string;
  billingCycle: string;
  trialDays: number;
  isActive: boolean;
  customCycleDays: number | null;
  subscriberCount: number;
  pendingCount: number;
  subscribers: Subscriber[];
  features?: PlanFeature[];
}

const FEATURE_KEYS = [
  { key: "max_linked_owners", label: "Max Linked Owners", defaultType: "numeric" },
  { key: "max_linked_tenants", label: "Max Linked Tenants", defaultType: "numeric" },
  { key: "dm_messaging", label: "DM Messaging", defaultType: "boolean" },
  { key: "document_viewing", label: "Document Viewing", defaultType: "boolean" },
];

const BILLING_LABELS: Record<string, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  one_time: "One-Time",
  custom: "Custom",
};

function emptyFeatures(): PlanFeature[] {
  return FEATURE_KEYS.map((fk) => ({
    featureKey: fk.key,
    limitType: fk.defaultType,
    booleanValue: fk.defaultType === "boolean" ? true : null,
    numericMin: fk.defaultType === "numeric" ? 0 : null,
    numericMax: fk.defaultType === "numeric" ? 10 : null,
  }));
}

export default function PlansPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "0",
    billingCycle: "monthly",
    trialDays: 7,
    isActive: true,
    customCycleDays: 30,
    features: emptyFeatures(),
  });

  const { data: plansList = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/admin/plans"],
    queryFn: () => api.get("/admin/plans"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/admin/plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/plans"] });
      setDialogOpen(false);
      toast({ title: "Plan created" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/admin/plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/plans"] });
      setDialogOpen(false);
      toast({ title: "Plan updated" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/plans"] });
      toast({ title: "Plan deleted" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingPlan(null);
    setForm({
      name: "",
      description: "",
      price: "0",
      billingCycle: "monthly",
      trialDays: 7,
      isActive: true,
      customCycleDays: 30,
      features: emptyFeatures(),
    });
    setDialogOpen(true);
  };

  const openEdit = async (plan: Plan) => {
    const full: any = await api.get(`/admin/plans/${plan.id}`);
    setEditingPlan(plan);
    const features = FEATURE_KEYS.map((fk) => {
      const existing = full.features?.find((f: PlanFeature) => f.featureKey === fk.key);
      return existing || {
        featureKey: fk.key,
        limitType: fk.defaultType,
        booleanValue: fk.defaultType === "boolean" ? true : null,
        numericMin: fk.defaultType === "numeric" ? 0 : null,
        numericMax: fk.defaultType === "numeric" ? 10 : null,
      };
    });
    setForm({
      name: full.name,
      description: full.description || "",
      price: full.price,
      billingCycle: full.billingCycle,
      trialDays: full.trialDays,
      isActive: full.isActive,
      customCycleDays: full.customCycleDays || 30,
      features,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: "Plan name is required", variant: "destructive" });
      return;
    }
    const data = { ...form };
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const updateFeature = (idx: number, field: string, value: any) => {
    setForm((prev) => {
      const features = [...prev.features];
      features[idx] = { ...features[idx], [field]: value };
      return { ...prev, features };
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Plans
          </h1>
          <p className="text-muted-foreground mt-1">Manage subscription plans and feature limits</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : plansList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No plans created yet</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plansList.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <Badge variant={plan.isActive ? "default" : "secondary"}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {plan.description && (
                  <CardDescription>{plan.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">AED {plan.price}</span>
                    <span className="text-sm text-muted-foreground">/ {BILLING_LABELS[plan.billingCycle] || plan.billingCycle}</span>
                  </div>
                  {plan.trialDays > 0 && (
                    <p className="text-xs text-muted-foreground">{plan.trialDays}-day trial</p>
                  )}
                  <button
                    type="button"
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                    onClick={() => setExpandedPlans((prev) => {
                      const next = new Set(prev);
                      if (next.has(plan.id)) next.delete(plan.id);
                      else next.add(plan.id);
                      return next;
                    })}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {plan.subscriberCount} subscriber{plan.subscriberCount !== 1 ? "s" : ""}
                    {plan.pendingCount > 0 && (
                      <Badge variant="outline" className="text-xs ml-1 text-amber-600 border-amber-300">
                        {plan.pendingCount} awaiting payment
                      </Badge>
                    )}
                    {plan.subscriberCount > 0 && (
                      expandedPlans.has(plan.id)
                        ? <ChevronUp className="h-3.5 w-3.5 ml-auto" />
                        : <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                    )}
                  </button>
                  {expandedPlans.has(plan.id) && (
                    <div className="border rounded-md divide-y text-sm">
                      {plan.subscribers.length === 0 ? (
                        <p className="px-3 py-2 text-muted-foreground">No active subscribers</p>
                      ) : (
                        plan.subscribers.map((sub) => (
                          <div key={sub.guestId} className="px-3 py-2 flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline"
                              onClick={() => navigate(`/admin/users/${sub.guestId}`)}
                            >
                              {sub.fullName}
                            </button>
                            <span className="text-muted-foreground">{sub.email}</span>
                            <Badge variant={sub.status === "active" ? "default" : "outline"} className="text-xs ml-auto">
                              {sub.status === "active" ? "Active" : "Trial"}
                            </Badge>
                            {sub.status === "trial" && sub.trialEndsAt && (
                              <span className="text-xs text-muted-foreground">
                                ends {new Date(sub.trialEndsAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={plan.subscriberCount > 0 || deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(plan.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
            <DialogDescription>
              {editingPlan ? "Update plan details and feature limits" : "Set up a new subscription plan"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Basic, Pro, Enterprise" />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (AED)</Label>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select value={form.billingCycle} onValueChange={(v) => setForm((p) => ({ ...p, billingCycle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="one_time">One-Time</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.billingCycle === "custom" && (
              <div className="space-y-2">
                <Label>Custom Cycle (days)</Label>
                <Input type="number" min="1" value={form.customCycleDays} onChange={(e) => setForm((p) => ({ ...p, customCycleDays: parseInt(e.target.value) || 30 }))} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trial Days</Label>
                <Input type="number" min="0" value={form.trialDays} onChange={(e) => setForm((p) => ({ ...p, trialDays: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.isActive} onCheckedChange={(v: boolean) => setForm((p) => ({ ...p, isActive: v }))} />
                <Label>Active</Label>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Feature Limits</Label>
              {form.features.map((f, idx) => {
                const fk = FEATURE_KEYS.find((k) => k.key === f.featureKey);
                return (
                  <div key={f.featureKey} className="flex items-center gap-3 p-3 border rounded-lg">
                    <span className="text-sm font-medium flex-1">{fk?.label || f.featureKey}</span>
                    {f.limitType === "boolean" ? (
                      <Switch
                        checked={f.booleanValue ?? false}
                        onCheckedChange={(v: boolean) => updateFeature(idx, "booleanValue", v)}
                      />
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        className="w-24"
                        value={f.numericMax ?? 0}
                        onChange={(e) => updateFeature(idx, "numericMax", parseInt(e.target.value) || 0)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
