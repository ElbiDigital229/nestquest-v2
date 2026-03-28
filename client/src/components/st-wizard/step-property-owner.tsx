import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Percent,
  DollarSign,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────

interface StepProps {
  property: any;
  onUpdate: (fields: Record<string, any>) => void;
}

interface LinkedPO {
  id: string;
  targetUserId: string;
  targetName: string | null;
  targetEmail: string;
  targetPhone: string | null;
  status: string;
}

// ── Component ──────────────────────────────────────────────

export default function StepPropertyOwner({ property, onUpdate }: StepProps) {
  const [selectedPoUserId, setSelectedPoUserId] = useState(property.poUserId || "");
  const [commissionType, setCommissionType] = useState(property.commissionType || "");
  const [commissionValue, setCommissionValue] = useState(property.commissionValue ?? "");

  // Fetch linked POs from /api/links?targetRole=PROPERTY_OWNER&status=accepted
  const { data: linkedPOs = [], isLoading } = useQuery<LinkedPO[]>({
    queryKey: ["/links", "PROPERTY_OWNER", "accepted"],
    queryFn: () => api.get("/links?targetRole=PROPERTY_OWNER&status=accepted"),
  });

  const selectedPO = linkedPOs.find((po) => po.targetUserId === selectedPoUserId);

  const handleSelectPO = useCallback(
    (poUserId: string) => {
      setSelectedPoUserId(poUserId);
      onUpdate({ poUserId });
    },
    [onUpdate],
  );

  const handleBlur = useCallback(
    (field: string, value: any) => {
      onUpdate({ [field]: value === "" ? null : value });
    },
    [onUpdate],
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* ── Select Property Owner ──────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Property Owner</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Select which property owner this listing belongs to. Only accepted linked POs are shown.
        </p>
        <Separator className="mb-4" />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : linkedPOs.length === 0 ? (
          <div className="rounded-md border border-dashed bg-white p-6 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No linked property owners found. Please invite a property owner first from the Property Owners page.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>
              Property Owner <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedPoUserId}
              onValueChange={handleSelectPO}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a property owner..." />
              </SelectTrigger>
              <SelectContent>
                {linkedPOs.map((po) => (
                  <SelectItem key={po.id} value={po.targetUserId}>
                    {po.targetName || "Unnamed Owner"} — {po.targetEmail}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      {/* ── Commission ────────────────────────────────────── */}
      {selectedPoUserId && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Commission Structure</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            Define the commission arrangement with{" "}
            <span className="font-medium">
              {selectedPO?.targetName || "the property owner"}
            </span>
            .
          </p>
          <Separator className="mb-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Commission Type */}
            <div className="space-y-1.5">
              <Label>
                Commission Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={commissionType}
                onValueChange={(v) => {
                  setCommissionType(v);
                  onUpdate({ commissionType: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_monthly">
                    Fixed Monthly (AED)
                  </SelectItem>
                  <SelectItem value="percentage_per_booking">
                    Percentage per Booking (%)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Commission Value */}
            <div className="space-y-1.5">
              <Label>
                Commission Value{" "}
                {commissionType === "percentage_per_booking" ? "(%)" : "(AED)"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                {commissionType === "fixed_monthly" ? (
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                ) : (
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                  type="number"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                  onBlur={() => handleBlur("commissionValue", commissionValue)}
                  placeholder={
                    commissionType === "percentage_per_booking"
                      ? "e.g. 15"
                      : "e.g. 5000"
                  }
                  className="pl-9"
                  min={0}
                  max={commissionType === "percentage_per_booking" ? 100 : undefined}
                />
              </div>
              {commissionType === "percentage_per_booking" && (
                <p className="text-xs text-muted-foreground">
                  Percentage deducted from each booking payout
                </p>
              )}
              {commissionType === "fixed_monthly" && (
                <p className="text-xs text-muted-foreground">
                  Fixed monthly management fee in AED
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
