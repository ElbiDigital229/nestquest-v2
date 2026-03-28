import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
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
import { Loader2, Check, CreditCard } from "lucide-react";

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
  plan_id: string;
  status: string;
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

export default function PlanSelection() {
  const [, navigate] = useLocation();

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/subscriptions/plans"],
    queryFn: () => api.get("/subscriptions/plans"),
  });

  const { data: currentSub } = useQuery<CurrentSub | null>({
    queryKey: ["/subscriptions/current"],
    queryFn: () => api.get("/subscriptions/current").catch(() => null) as Promise<CurrentSub | null>,
  });

  const currentPlanId = currentSub?.plan_id;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2">
          Select a subscription plan that fits your needs
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
                  {plan.trialDays > 0 && (
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
                    {isCurrent ? "Current Plan" : "Select Plan"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
