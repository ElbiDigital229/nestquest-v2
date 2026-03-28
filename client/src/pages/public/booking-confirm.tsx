import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import PublicLayout from "@/components/layout/public-layout";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  Users,
  Bed,
  Bath,
  ArrowLeft,
  Loader2,
  Shield,
  Clock,
  AlertCircle,
} from "lucide-react";

interface PriceBreakdown {
  weekdayNights: number;
  weekendNights: number;
  totalNights: number;
  nightlyRate: string;
  weekendRate: string;
  subtotal: string;
  cleaningFee: string;
  tourismTax: string;
  vat: string;
  securityDeposit: string;
  total: string;
  minimumStay: number;
}

interface PropertySummary {
  id: string;
  publicName: string;
  propertyType: string;
  city: string;
  areaName: string | null;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  coverPhoto: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  cancellationPolicy: string | null;
  acceptedPaymentMethods: string[];
}

export default function BookingConfirm() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const propertyId = params.get("propertyId") || "";
  const checkIn = params.get("checkIn") || "";
  const checkOut = params.get("checkOut") || "";
  const guests = parseInt(params.get("guests") || "1");

  const [property, setProperty] = useState<PropertySummary | null>(null);
  const [pricing, setPricing] = useState<PriceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      const returnTo = `/booking/confirm?propertyId=${propertyId}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;
      navigate(`/login/guest?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [user]);

  useEffect(() => {
    if (!propertyId || !checkIn || !checkOut) {
      setError("Missing booking details");
      setLoading(false);
      return;
    }

    Promise.all([
      api.get<PropertySummary>(`/public/properties/${propertyId}`),
      api.post<PriceBreakdown>("/bookings/calculate-price", { propertyId, checkIn, checkOut }),
    ])
      .then(([prop, price]) => {
        setProperty(prop);
        setPricing(price);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load booking details");
        setLoading(false);
      });
  }, [propertyId, checkIn, checkOut]);

  if (!user) return null;

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
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-80" />
          </div>
        </div>
      </PublicLayout>
    );
  }

  const policyLabels: Record<string, string> = {
    flexible: "Free cancellation up to 24h before check-in",
    moderate: "Free cancellation up to 5 days before check-in",
    strict: "50% refund up to 7 days before check-in",
    non_refundable: "No refund after booking",
  };

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const handleProceed = () => {
    navigate(
      `/booking/payment?propertyId=${propertyId}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`
    );
  };

  return (
    <PublicLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(`/property/${propertyId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Property
        </Button>

        <h1 className="text-2xl font-bold mb-6">Confirm Your Booking</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Property Summary */}
            <Card>
              <CardContent className="p-4 flex gap-4">
                {property.coverPhoto ? (
                  <img
                    src={property.coverPhoto}
                    alt={property.publicName}
                    className="w-32 h-24 object-cover rounded-lg shrink-0"
                  />
                ) : (
                  <div className="w-32 h-24 bg-muted rounded-lg shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                    No Photo
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{property.publicName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {property.areaName || property.city}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{property.bedrooms}</span>
                    <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{property.bathrooms}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{property.maxGuests}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trip Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trip Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                      <Calendar className="h-3 w-3" /> Check-in
                    </p>
                    <p className="font-medium">{formatDate(checkIn)}</p>
                    {property.checkInTime && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> After {property.checkInTime}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                      <Calendar className="h-3 w-3" /> Check-out
                    </p>
                    <p className="font-medium">{formatDate(checkOut)}</p>
                    {property.checkOutTime && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> Before {property.checkOutTime}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                    <Users className="h-3 w-3" /> Guests
                  </p>
                  <p className="font-medium">{guests} {guests === 1 ? "guest" : "guests"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Duration</p>
                  <p className="font-medium">{pricing.totalNights} {pricing.totalNights === 1 ? "night" : "nights"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Cancellation Policy */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium capitalize">{(property.cancellationPolicy || "flexible").replace(/_/g, " ")} Cancellation</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {policyLabels[property.cancellationPolicy || "flexible"]}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guest Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Guest Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Name</span>
                    <span className="text-sm font-medium">{user.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm font-medium">{user.email}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Price Summary */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Price Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pricing.weekdayNights > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{pricing.weekdayNights} weekday {pricing.weekdayNights === 1 ? "night" : "nights"} x AED {Number(pricing.nightlyRate).toLocaleString()}</span>
                    <span>AED {(pricing.weekdayNights * Number(pricing.nightlyRate)).toLocaleString()}</span>
                  </div>
                )}
                {pricing.weekendNights > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{pricing.weekendNights} weekend {pricing.weekendNights === 1 ? "night" : "nights"} x AED {Number(pricing.weekendRate).toLocaleString()}</span>
                    <span>AED {(pricing.weekendNights * Number(pricing.weekendRate)).toLocaleString()}</span>
                  </div>
                )}

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
                    <span>
                      Security deposit
                      <Badge variant="outline" className="ml-1 text-[10px]">Refundable</Badge>
                    </span>
                    <span>AED {Number(pricing.securityDeposit).toLocaleString()}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>AED {Number(pricing.total).toLocaleString()}</span>
                </div>

                <Button className="w-full mt-4" size="lg" onClick={handleProceed}>
                  Continue to Payment
                </Button>

                {property.acceptedPaymentMethods && property.acceptedPaymentMethods.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                    {property.acceptedPaymentMethods.map((m) => (
                      <Badge key={m} variant="secondary" className="text-[10px]">
                        {m.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
