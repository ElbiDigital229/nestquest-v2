import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import PublicLayout from "@/components/layout/public-layout";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  CreditCard,
  Banknote,
  AlertCircle,
  Lock,
} from "lucide-react";

interface PriceBreakdown {
  totalNights: number;
  subtotal: string;
  cleaningFee: string;
  tourismTax: string;
  vat: string;
  securityDeposit: string;
  total: string;
}

interface PropertyInfo {
  id: string;
  publicName: string;
  acceptedPaymentMethods: string[];
}

const PAYMENT_LABELS: Record<string, { label: string; icon: any }> = {
  bank_transfer: { label: "Bank Transfer", icon: Banknote },
  credit_card: { label: "Credit Card", icon: CreditCard },
  cash: { label: "Cash", icon: Banknote },
  cheque: { label: "Cheque", icon: Banknote },
};

export default function BookingPayment() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const propertyId = params.get("propertyId") || "";
  const checkIn = params.get("checkIn") || "";
  const checkOut = params.get("checkOut") || "";
  const guests = parseInt(params.get("guests") || "1");

  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [pricing, setPricing] = useState<PriceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("");
  // Mock card fields (UI only)
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login/guest");
      return;
    }
    if (!propertyId || !checkIn || !checkOut) {
      setError("Missing booking details");
      setLoading(false);
      return;
    }

    Promise.all([
      api.get<PropertyInfo>(`/public/properties/${propertyId}`),
      api.post<PriceBreakdown>("/bookings/calculate-price", { propertyId, checkIn, checkOut }),
    ])
      .then(([prop, price]) => {
        setProperty(prop);
        setPricing(price);
        const methods = prop.acceptedPaymentMethods || [];
        if (methods.length === 1) setPaymentMethod(methods[0]);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [propertyId, checkIn, checkOut, user]);

  if (!user) return null;

  const handleSubmit = async () => {
    if (!paymentMethod) {
      toast({ title: "Please select a payment method", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.post<{ id: string }>("/bookings", {
        propertyId,
        checkIn,
        checkOut,
        guests,
        paymentMethod,
        specialRequests: "",
      });

      navigate(`/booking/success?bookingId=${result.id}`);
    } catch (err: any) {
      toast({ title: err.message || "Booking failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <PublicLayout>
        <div className="container max-w-4xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate("/search")}>Back to Search</Button>
        </div>
      </PublicLayout>
    );
  }

  if (loading || !property || !pricing) {
    return (
      <PublicLayout>
        <div className="container max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </PublicLayout>
    );
  }

  const methods = property.acceptedPaymentMethods || [];

  return (
    <PublicLayout>
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate(`/booking/confirm?propertyId=${propertyId}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <h1 className="text-2xl font-bold mb-6">Payment</h1>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Left: Payment Form */}
          <div className="md:col-span-3 space-y-6">
            {/* Payment Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                {methods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payment methods configured for this property.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {methods.map((m) => {
                      const info = PAYMENT_LABELS[m] || { label: m.replace(/_/g, " "), icon: CreditCard };
                      const Icon = info.icon;
                      return (
                        <button
                          key={m}
                          onClick={() => setPaymentMethod(m)}
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left ${
                            paymentMethod === m
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="font-medium text-sm capitalize">{info.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mock Card Form — only show for credit_card */}
            {paymentMethod === "credit_card" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Card Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    This is a demo — no real payment will be processed.
                  </p>
                  <div className="space-y-2">
                    <Label>Cardholder Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Card Number</Label>
                    <Input
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                        setCardNumber(v.replace(/(.{4})/g, "$1 ").trim());
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Expiry</Label>
                      <Input
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                          if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                          setCardExpiry(v);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CVC</Label>
                      <Input
                        placeholder="123"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bank Transfer instructions */}
            {paymentMethod === "bank_transfer" && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    After submitting, the property manager will provide bank transfer details.
                    Your booking will be held for 24 hours pending confirmation.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Cash instructions */}
            {paymentMethod === "cash" && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Cash payment will be collected at check-in. Your booking will be held for 24 hours pending PM confirmation.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Summary */}
          <div className="md:col-span-2">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-medium">{property.publicName}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(checkIn + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" — "}
                  {new Date(checkOut + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" "}({pricing.totalNights} nights)
                </p>
                <p className="text-sm text-muted-foreground">{guests} {guests === 1 ? "guest" : "guests"}</p>

                <Separator />

                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>AED {Number(pricing.subtotal).toLocaleString()}</span>
                </div>
                {Number(pricing.cleaningFee) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Cleaning fee</span>
                    <span>AED {Number(pricing.cleaningFee).toLocaleString()}</span>
                  </div>
                )}
                {Number(pricing.tourismTax) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Tourism tax</span>
                    <span>AED {Number(pricing.tourismTax).toLocaleString()}</span>
                  </div>
                )}
                {Number(pricing.vat) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>VAT</span>
                    <span>AED {Number(pricing.vat).toLocaleString()}</span>
                  </div>
                )}
                {Number(pricing.securityDeposit) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Security deposit</span>
                    <span>AED {Number(pricing.securityDeposit).toLocaleString()}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>AED {Number(pricing.total).toLocaleString()}</span>
                </div>

                <Button
                  className="w-full mt-4"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={submitting || !paymentMethod}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {submitting ? "Processing..." : "Confirm & Book"}
                </Button>

                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Your booking request will be sent to the property manager for confirmation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
