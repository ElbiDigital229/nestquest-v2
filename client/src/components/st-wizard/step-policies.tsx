import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  Clock,
  Plus,
  GripVertical,
  Trash2,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────

interface Policy {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
}

interface StepPoliciesProps {
  property: any;
  policies: Policy[];
  onUpdate: (fields: Record<string, any>) => void;
  onRefresh: () => void;
  propertyId: string;
}

// ── Time options ───────────────────────────────────────────

function generateTimeOptions() {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of ["00", "30"]) {
      const val = `${h.toString().padStart(2, "0")}:${m}`;
      const ampm = h === 0 ? "12" : h > 12 ? `${h - 12}` : `${h}`;
      const suffix = h < 12 ? "AM" : "PM";
      options.push({ value: val, label: `${ampm}:${m} ${suffix}` });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

const CANCELLATION_OPTIONS = [
  { value: "flexible", label: "Flexible", desc: "Full refund up to 24 hours before check-in" },
  { value: "moderate", label: "Moderate", desc: "Full refund up to 5 days before check-in" },
  { value: "strict", label: "Strict", desc: "50% refund up to 7 days before check-in" },
  { value: "non_refundable", label: "Non-Refundable", desc: "No refund after booking" },
];

// ── Component ──────────────────────────────────────────────

export default function StepPolicies({
  property,
  policies,
  onUpdate,
  onRefresh,
  propertyId,
}: StepPoliciesProps) {
  const [checkInTime, setCheckInTime] = useState(property.checkInTime || "15:00");
  const [checkOutTime, setCheckOutTime] = useState(property.checkOutTime || "12:00");
  const [cancellationPolicy, setCancellationPolicy] = useState(property.cancellationPolicy || "");

  // New policy form
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyDesc, setNewPolicyDesc] = useState("");

  const addPolicyMutation = useMutation({
    mutationFn: (body: { name: string; description: string | null }) =>
      api.post(`/st-properties/${propertyId}/policies`, body),
    onSuccess: () => {
      setNewPolicyName("");
      setNewPolicyDesc("");
      onRefresh();
    },
  });

  const deletePolicyMutation = useMutation({
    mutationFn: (policyId: string) =>
      api.delete(`/st-properties/${propertyId}/policies/${policyId}`),
    onSuccess: () => {
      onRefresh();
    },
  });

  const handleAddPolicy = useCallback(() => {
    if (!newPolicyName.trim()) return;
    addPolicyMutation.mutate({
      name: newPolicyName.trim(),
      description: newPolicyDesc.trim() || null,
    });
  }, [newPolicyName, newPolicyDesc, addPolicyMutation]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* ── Check-in / Check-out Times ────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Check-in & Check-out</h3>
        </div>
        <Separator className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div className="space-y-1.5">
            <Label>
              Check-in Time <span className="text-destructive">*</span>
            </Label>
            <Select
              value={checkInTime}
              onValueChange={(v) => {
                setCheckInTime(v);
                onUpdate({ checkInTime: v });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Check-out Time <span className="text-destructive">*</span>
            </Label>
            <Select
              value={checkOutTime}
              onValueChange={(v) => {
                setCheckOutTime(v);
                onUpdate({ checkOutTime: v });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* ── Cancellation Policy ────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Cancellation Policy</h3>
        </div>
        <Separator className="mb-4" />

        <div className="space-y-1.5">
          <Label>
            Cancellation Policy <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CANCELLATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setCancellationPolicy(opt.value);
                  onUpdate({ cancellationPolicy: opt.value });
                }}
                className={`text-left rounded-md border p-3 transition-colors ${
                  cancellationPolicy === opt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "bg-white border-border hover:bg-muted"
                }`}
              >
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Custom House Rules ──────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Custom House Rules</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Add any additional rules or policies for guests. These are optional.
        </p>
        <Separator className="mb-4" />

        {/* Existing policies */}
        {policies.length > 0 && (
          <div className="space-y-2 mb-4">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{policy.name}</p>
                  {policy.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {policy.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deletePolicyMutation.mutate(policy.id)}
                  disabled={deletePolicyMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new policy form */}
        <div className="rounded-md border p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Rule Name</Label>
            <Input
              value={newPolicyName}
              onChange={(e) => setNewPolicyName(e.target.value)}
              placeholder="e.g. No Smoking Indoors"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={newPolicyDesc}
              onChange={(e) => setNewPolicyDesc(e.target.value)}
              placeholder="Additional details about this rule..."
              rows={2}
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddPolicy}
            disabled={!newPolicyName.trim() || addPolicyMutation.isPending}
          >
            {addPolicyMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1.5" />
            )}
            Add Rule
          </Button>
        </div>
      </section>
    </div>
  );
}
