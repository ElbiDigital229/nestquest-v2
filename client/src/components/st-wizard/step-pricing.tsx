import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DollarSign, CreditCard, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────

interface StepProps {
  property: any;
  onUpdate: (fields: Record<string, any>) => void;
}

// ── Counter sub-component ──────────────────────────────────

function Counter({
  value,
  min = 0,
  onChange,
}: {
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 bg-white"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-8 text-center font-medium tabular-nums">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 bg-white"
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Payment method chips ───────────────────────────────────

const PAYMENT_METHODS = [
  { key: "card", label: "Card" },
  { key: "cash", label: "Cash" },
  { key: "bank_transfer", label: "Bank Transfer" },
];

// ── Component ──────────────────────────────────────────────

export default function StepPricing({ property, onUpdate }: StepProps) {
  // Rates
  const [nightlyRate, setNightlyRate] = useState(property.nightlyRate ?? "");
  const [weekendRate, setWeekendRate] = useState(property.weekendRate ?? "");
  const [minimumStay, setMinimumStay] = useState(property.minimumStay ?? 1);
  const [maximumStay, setMaximumStay] = useState(property.maximumStay ?? 30);

  // Fees
  const [cleaningFee, setCleaningFee] = useState(property.cleaningFee ?? "");
  const [securityDepositRequired, setSecurityDepositRequired] = useState(
    property.securityDepositRequired ?? false,
  );
  const [securityDepositAmount, setSecurityDepositAmount] = useState(
    property.securityDepositAmount ?? "",
  );

  // Payment methods
  const parseMethods = (raw: any): string[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  };

  const parseConfig = (raw: any): Record<string, any> => {
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch {}
    }
    return {};
  };

  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<string[]>(
    parseMethods(property.acceptedPaymentMethods),
  );

  const [methodConfig, setMethodConfig] = useState<Record<string, any>>(
    parseConfig(property.paymentMethodConfig),
  );

  // Legacy bank fields (kept for backward compat)
  const [accountBelongsTo, setAccountBelongsTo] = useState(property.bankAccountBelongsTo || "");
  const [bankName, setBankName] = useState(property.bankName || "");
  const [accountHolderName, setAccountHolderName] = useState(property.accountHolderName || "");
  const [accountNumber, setAccountNumber] = useState(property.accountNumber || "");
  const [iban, setIban] = useState(property.iban || "");
  const [swiftCode, setSwiftCode] = useState(property.swiftCode || "");

  const updateMethodConfig = useCallback((method: string, field: string, value: string) => {
    setMethodConfig(prev => {
      const updated = { ...prev, [method]: { ...(prev[method] || {}), [field]: value } };
      onUpdate({ paymentMethodConfig: JSON.stringify(updated) });
      return updated;
    });
  }, [onUpdate]);

  const handleBlur = useCallback(
    (field: string, value: any) => {
      onUpdate({ [field]: value === "" ? null : value });
    },
    [onUpdate],
  );

  const updateField = useCallback(
    (field: string, value: any) => {
      onUpdate({ [field]: value });
    },
    [onUpdate],
  );

  const togglePaymentMethod = useCallback(
    (method: string) => {
      setAcceptedPaymentMethods((prev) => {
        const next = prev.includes(method)
          ? prev.filter((m) => m !== method)
          : [...prev, method];
        onUpdate({ acceptedPaymentMethods: JSON.stringify(next) });
        return next;
      });
    },
    [onUpdate],
  );

  const showBankDetails = acceptedPaymentMethods.includes("bank_transfer");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* ── Rates ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Rates</h3>
        </div>
        <Separator className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Nightly Rate */}
          <div className="space-y-1.5">
            <Label>
              Nightly Rate (AED) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              value={nightlyRate}
              onChange={(e) => setNightlyRate(e.target.value)}
              onBlur={() =>
                handleBlur(
                  "nightlyRate",
                  nightlyRate === "" ? null : parseFloat(nightlyRate),
                )
              }
              placeholder="e.g. 500"
              min={0}
            />
          </div>

          {/* Weekend Rate */}
          <div className="space-y-1.5">
            <Label>Weekend Rate (AED)</Label>
            <Input
              type="number"
              value={weekendRate}
              onChange={(e) => setWeekendRate(e.target.value)}
              onBlur={() =>
                handleBlur(
                  "weekendRate",
                  weekendRate === "" ? null : parseFloat(weekendRate),
                )
              }
              placeholder="e.g. 650"
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              Override for Fri/Sat nights
            </p>
          </div>

          {/* Minimum Stay */}
          <div className="space-y-1.5">
            <Label>Minimum Stay (nights)</Label>
            <Counter
              value={minimumStay}
              min={1}
              onChange={(v) => {
                setMinimumStay(v);
                updateField("minimumStay", v);
              }}
            />
          </div>

          {/* Maximum Stay */}
          <div className="space-y-1.5">
            <Label>Maximum Stay (nights)</Label>
            <Counter
              value={maximumStay}
              min={1}
              onChange={(v) => {
                setMaximumStay(v);
                updateField("maximumStay", v);
              }}
            />
          </div>
        </div>
      </section>

      {/* ── Fees ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Fees</h3>
        </div>
        <Separator className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Cleaning Fee */}
          <div className="space-y-1.5">
            <Label>Cleaning Fee (AED)</Label>
            <Input
              type="number"
              value={cleaningFee}
              onChange={(e) => setCleaningFee(e.target.value)}
              onBlur={() =>
                handleBlur(
                  "cleaningFee",
                  cleaningFee === "" ? null : parseFloat(cleaningFee),
                )
              }
              placeholder="e.g. 150"
              min={0}
            />
          </div>

          {/* Security Deposit Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2.5">
              <Label className="cursor-pointer">Security Deposit Required</Label>
              <Switch
                checked={securityDepositRequired}
                onCheckedChange={(v) => {
                  setSecurityDepositRequired(v);
                  updateField("securityDepositRequired", v);
                  if (!v) {
                    setSecurityDepositAmount("");
                    updateField("securityDepositAmount", null);
                  }
                }}
              />
            </div>

            {securityDepositRequired && (
              <div className="space-y-1.5">
                <Label>Security Deposit Amount (AED)</Label>
                <Input
                  type="number"
                  value={securityDepositAmount}
                  onChange={(e) => setSecurityDepositAmount(e.target.value)}
                  onBlur={() =>
                    handleBlur(
                      "securityDepositAmount",
                      securityDepositAmount === ""
                        ? null
                        : parseFloat(securityDepositAmount),
                    )
                  }
                  placeholder="e.g. 2000"
                  min={0}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Guest Payment Methods ──────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Guest Payment Methods</h3>
        </div>
        <Separator className="mb-4" />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Accepted Payment Methods{" "}
              <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((pm) => {
                const isSelected = acceptedPaymentMethods.includes(pm.key);
                return (
                  <button
                    key={pm.key}
                    type="button"
                    onClick={() => togglePaymentMethod(pm.key)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-white text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {pm.label}
                  </button>
                );
              })}
            </div>
            {acceptedPaymentMethods.length === 0 && (
              <p className="text-xs text-destructive">
                At least one payment method is required.
              </p>
            )}
          </div>

          {/* ── Card Config ── */}
          {acceptedPaymentMethods.includes("card") && (
            <div className="rounded-md border p-4 space-y-4">
              <h4 className="text-sm font-medium">Card Payment Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1.5">
                  <Label>Account Belongs To</Label>
                  <select
                    value={methodConfig.card?.belongsTo || ""}
                    onChange={(e) => updateMethodConfig("card", "belongsTo", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select...</option>
                    <option value="property_manager">Property Manager</option>
                    <option value="property_owner">Property Owner</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Account Reference</Label>
                  <Input
                    value={methodConfig.card?.accountRef || ""}
                    onChange={(e) => updateMethodConfig("card", "accountRef", e.target.value)}
                    placeholder="e.g. Stripe account ID"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Holder</Label>
                  <Input
                    value={methodConfig.card?.accountHolder || ""}
                    onChange={(e) => updateMethodConfig("card", "accountHolder", e.target.value)}
                    placeholder="Account holder name"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Bank Transfer Config ── */}
          {acceptedPaymentMethods.includes("bank_transfer") && (
            <div className="rounded-md border p-4 space-y-4">
              <h4 className="text-sm font-medium">Bank Transfer Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1.5">
                  <Label>Account Belongs To</Label>
                  <select
                    value={methodConfig.bank_transfer?.belongsTo || accountBelongsTo || ""}
                    onChange={(e) => {
                      setAccountBelongsTo(e.target.value);
                      updateField("bankAccountBelongsTo", e.target.value || null);
                      updateMethodConfig("bank_transfer", "belongsTo", e.target.value);
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select...</option>
                    <option value="property_manager">Property Manager</option>
                    <option value="property_owner">Property Owner</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bank Name</Label>
                  <Input
                    value={methodConfig.bank_transfer?.bankName || bankName}
                    onChange={(e) => {
                      setBankName(e.target.value);
                      updateMethodConfig("bank_transfer", "bankName", e.target.value);
                    }}
                    onBlur={() => handleBlur("bankName", bankName)}
                    placeholder="e.g. Emirates NBD"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Holder Name</Label>
                  <Input
                    value={methodConfig.bank_transfer?.accountHolder || accountHolderName}
                    onChange={(e) => {
                      setAccountHolderName(e.target.value);
                      updateMethodConfig("bank_transfer", "accountHolder", e.target.value);
                    }}
                    onBlur={() => handleBlur("accountHolderName", accountHolderName)}
                    placeholder="Full name on account"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Number</Label>
                  <Input
                    value={methodConfig.bank_transfer?.accountNumber || accountNumber}
                    onChange={(e) => {
                      setAccountNumber(e.target.value);
                      updateMethodConfig("bank_transfer", "accountNumber", e.target.value);
                    }}
                    onBlur={() => handleBlur("accountNumber", accountNumber)}
                    placeholder="Account number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>IBAN</Label>
                  <Input
                    value={methodConfig.bank_transfer?.iban || iban}
                    onChange={(e) => {
                      setIban(e.target.value);
                      updateMethodConfig("bank_transfer", "iban", e.target.value);
                    }}
                    onBlur={() => handleBlur("iban", iban)}
                    placeholder="e.g. AE070331234567890123456"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>SWIFT Code</Label>
                  <Input
                    value={methodConfig.bank_transfer?.swiftCode || swiftCode}
                    onChange={(e) => {
                      setSwiftCode(e.target.value);
                      updateMethodConfig("bank_transfer", "swiftCode", e.target.value);
                    }}
                    onBlur={() => handleBlur("swiftCode", swiftCode)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Cash Config ── */}
          {acceptedPaymentMethods.includes("cash") && (
            <div className="rounded-md border p-4 space-y-4">
              <h4 className="text-sm font-medium">Cash Collection Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1.5">
                  <Label>Collected By</Label>
                  <select
                    value={methodConfig.cash?.collectedBy || ""}
                    onChange={(e) => updateMethodConfig("cash", "collectedBy", e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select...</option>
                    <option value="property_manager">Property Manager</option>
                    <option value="property_owner">Property Owner</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
