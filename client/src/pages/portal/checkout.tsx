import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Lock, ArrowLeft, Check } from "lucide-react";

interface PlanFeature {
  featureKey: string;
  limitType: string;
  booleanValue: boolean | null;
  numericMax: number | null;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: string;
  billingCycle: string;
  trialDays: number;
  features: PlanFeature[];
}

const BILLING_LABELS: Record<string, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  one_time: "One-Time",
  custom: "Custom",
};

const FEATURE_LABELS: Record<string, string> = {
  max_linked_owners: "Linked Owners",
  max_linked_tenants: "Linked Tenants",
  dm_messaging: "Direct Messaging",
  document_viewing: "Document Viewing",
};

export default function Checkout() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const planId = params.get("planId");
  const isActivation = params.get("activate") === "true"; // SA-assigned plan, just need payment
  const { toast } = useToast();

  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    expiry: "",
    cvc: "",
    name: "",
  });

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/subscriptions/plans"],
    queryFn: () => api.get("/subscriptions/plans"),
  });

  const plan = plans.find((p) => p.id === planId);

  const queryClient = useQueryClient();

  // Normal checkout — creates new subscription
  const checkoutMutation = useMutation({
    mutationFn: () => api.post("/subscriptions/checkout", { planId, cardLast4: cardForm.cardNumber.replace(/\s/g, "").slice(-4), cardBrand: "Visa", cardName: cardForm.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/current"] });
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/payment-method"] });
      toast({ title: "Subscription activated successfully!" });
      navigate("/portal/settings");
    },
    onError: (e: any) => {
      toast({ title: e.message || "Checkout failed", variant: "destructive" });
    },
  });

  // Activation — pays for SA-assigned pending subscription
  const activateMutation = useMutation({
    mutationFn: () => api.post("/subscriptions/activate", { cardLast4: cardForm.cardNumber.replace(/\s/g, "").slice(-4), cardBrand: "Visa", cardName: cardForm.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/current"] });
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/payment-method"] });
      toast({ title: "Payment completed! Your subscription is now active." });
      navigate("/portal/settings");
    },
    onError: (e: any) => {
      toast({ title: e.message || "Payment failed", variant: "destructive" });
    },
  });

  const isPending = checkoutMutation.isPending || activateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.name.trim() || !cardForm.cardNumber.trim()) {
      toast({ title: "Please fill in card details", variant: "destructive" });
      return;
    }
    if (isActivation) {
      activateMutation.mutate();
    } else {
      checkoutMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">Plan not found</p>
        <Button variant="outline" onClick={() => navigate("/portal/plans")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Plans
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/portal/plans")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Plans
      </Button>

      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Order Summary */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{plan.name}</h3>
              {plan.description && (
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              )}
            </div>
            <Separator />
            <div className="space-y-2">
              {plan.features.map((f) => (
                <div key={f.featureKey} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span>
                    {f.limitType === "boolean"
                      ? FEATURE_LABELS[f.featureKey] || f.featureKey
                      : `Up to ${f.numericMax} ${FEATURE_LABELS[f.featureKey] || f.featureKey}`}
                  </span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Billing</span>
              <Badge variant="secondary">{BILLING_LABELS[plan.billingCycle]}</Badge>
            </div>
            {plan.trialDays > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">Trial</span>
                <span className="text-sm">{plan.trialDays} days free</span>
              </div>
            )}
            <Separator />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold">AED {plan.price}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Details
            </CardTitle>
            <CardDescription>
              <span className="flex items-center gap-1 text-xs">
                <Lock className="h-3 w-3" />
                Secure mock payment — no real charges
              </span>
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name on Card</Label>
                <Input
                  placeholder="John Doe"
                  value={cardForm.name}
                  onChange={(e) => setCardForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Card Number</Label>
                <Input
                  placeholder="4242 4242 4242 4242"
                  value={cardForm.cardNumber}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                    const formatted = v.replace(/(\d{4})(?=\d)/g, "$1 ");
                    setCardForm((p) => ({ ...p, cardNumber: formatted }));
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry</Label>
                  <Input
                    placeholder="MM/YY"
                    value={cardForm.expiry}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                      setCardForm((p) => ({ ...p, expiry: v }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CVC</Label>
                  <Input
                    placeholder="123"
                    value={cardForm.cvc}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setCardForm((p) => ({ ...p, cvc: v }));
                    }}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {isActivation ? `Pay — AED ${plan.price}` : `Subscribe — AED ${plan.price}`}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
