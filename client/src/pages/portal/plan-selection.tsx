import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Check, CreditCard, Receipt, AlertTriangle, XCircle } from "lucide-react";

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

interface CurrentSub {
  id: string;
  plan_id: string;
  status: string;
  planName: string;
  planPrice: string;
  planBillingCycle: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
}

interface Invoice {
  id: string;
  amount: string;
  invoice_status: string;
  planName: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

const BILLING_LABELS: Record<string, string> = {
  monthly: "mo",
  yearly: "yr",
  one_time: "one-time",
  custom: "cycle",
};

const FEATURE_LABELS: Record<string, string> = {
  max_linked_owners: "Linked Owners",
  max_linked_tenants: "Linked Tenants",
  dm_messaging: "Direct Messaging",
  document_viewing: "Document Viewing",
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-700",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PlanSelection() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/subscriptions/plans"],
    queryFn: () => api.get("/subscriptions/plans"),
  });

  const { data: currentSub } = useQuery<CurrentSub | null>({
    queryKey: ["/subscriptions/current"],
    queryFn: () => api.get("/subscriptions/current").catch(() => null) as Promise<CurrentSub | null>,
  });

  const { data: invoiceData } = useQuery<{ invoices: Invoice[]; total: number }>({
    queryKey: ["/subscriptions/invoices"],
    queryFn: () => api.get("/subscriptions/invoices"),
  });

  const { data: paymentMethod } = useQuery<{ cardBrand: string; cardLast4: string; cardHolderName: string } | null>({
    queryKey: ["/subscriptions/payment-method"],
    queryFn: () => api.get("/subscriptions/payment-method").catch(() => null),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post("/subscriptions/cancel"),
    onSuccess: () => {
      toast({ title: "Subscription cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/current"] });
      queryClient.invalidateQueries({ queryKey: ["/subscriptions/invoices"] });
      setCancelOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    },
  });

  const currentPlanId = currentSub?.plan_id;
  const invoices = invoiceData?.invoices || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current Subscription */}
      {currentSub && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold">{currentSub.planName}</h3>
                  <Badge className={
                    currentSub.status === "active" ? "bg-green-100 text-green-800 border-0" :
                    currentSub.status === "trial" ? "bg-blue-100 text-blue-800 border-0" :
                    "bg-yellow-100 text-yellow-800 border-0"
                  }>
                    {currentSub.status === "trial" ? "Trial" : currentSub.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">
                  AED {currentSub.planPrice}
                  <span className="text-sm text-muted-foreground font-normal">
                    /{BILLING_LABELS[currentSub.planBillingCycle] || currentSub.planBillingCycle}
                  </span>
                </p>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>Period: {formatDate(currentSub.current_period_start)} — {formatDate(currentSub.current_period_end)}</p>
                  {currentSub.trial_ends_at && (
                    <p>Trial ends: {formatDate(currentSub.trial_ends_at)}</p>
                  )}
                </div>
                {paymentMethod && (
                  <p className="text-sm text-muted-foreground">
                    Payment: {paymentMethod.cardBrand} ending in {paymentMethod.cardLast4}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold">{currentSub ? "Change Plan" : "Choose Your Plan"}</h2>
          <p className="text-muted-foreground mt-1">
            {currentSub ? "Upgrade or downgrade your subscription" : "Select a subscription plan that fits your needs"}
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No plans available at the moment</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              return (
                <Card
                  key={plan.id}
                  className={isCurrent ? "border-primary shadow-md" : ""}
                >
                  <CardHeader className="text-center pb-2">
                    {isCurrent && (
                      <Badge className="w-fit mx-auto mb-2">Current Plan</Badge>
                    )}
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    {plan.description && (
                      <CardDescription>{plan.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="mb-6">
                      <span className="text-4xl font-bold">AED {plan.price}</span>
                      <span className="text-muted-foreground">
                        /{BILLING_LABELS[plan.billingCycle] || plan.billingCycle}
                      </span>
                    </div>
                    {plan.trialDays > 0 && !currentSub && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {plan.trialDays}-day free trial
                      </p>
                    )}
                    <div className="space-y-3 text-left">
                      {plan.features.map((f) => (
                        <div key={f.featureKey} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600 shrink-0" />
                          <span>
                            {f.limitType === "boolean"
                              ? FEATURE_LABELS[f.featureKey] || f.featureKey
                              : `Up to ${f.numericMax} ${FEATURE_LABELS[f.featureKey] || f.featureKey}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent}
                      onClick={() => navigate(`/portal/checkout?planId=${plan.id}`)}
                    >
                      {isCurrent ? "Current Plan" : currentSub ? "Switch to This Plan" : "Select Plan"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No invoices yet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Plan</th>
                    <th className="px-4 py-2.5 font-medium">Period</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(inv.created_at)}</td>
                      <td className="px-4 py-2.5 font-medium">{inv.planName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatDate(inv.billing_period_start)} — {formatDate(inv.billing_period_end)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-[10px] border-0 ${INVOICE_STATUS_STYLES[inv.invoice_status] || "bg-gray-100 text-gray-700"}`}>
                          {inv.invoice_status}
                        </Badge>
                        {inv.paid_at && (
                          <span className="text-xs text-muted-foreground ml-1">
                            {formatDate(inv.paid_at)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">AED {Number(inv.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel Subscription
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your <strong>{currentSub?.planName}</strong> subscription?
              You'll lose access to premium features at the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Plan</Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
