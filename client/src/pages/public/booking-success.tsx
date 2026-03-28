import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import PublicLayout from "@/components/layout/public-layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  Home,
} from "lucide-react";

interface BookingDetail {
  id: string;
  propertyName: string;
  propertyCity: string;
  checkInDate: string;
  checkOutDate: string;
  totalNights: number;
  numberOfGuests: number;
  totalAmount: string;
  status: string;
  paymentMethod: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  expiresAt: string | null;
}

export default function BookingSuccess() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("bookingId") || "";

  const [booking, setBooking] = useState<BookingDetail | null>(null);

  useEffect(() => {
    if (bookingId) {
      api.get<BookingDetail>(`/bookings/${bookingId}`).then(setBooking).catch(() => {});
    }
  }, [bookingId]);

  const formatDate = (d: string) =>
    new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <PublicLayout>
      <div className="container max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Booking Submitted!</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your booking request has been sent to the property manager.
            You'll receive a notification once it's confirmed.
          </p>
        </div>

        {booking && (
          <Card className="mb-8">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{booking.propertyName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {booking.propertyCity}
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {booking.status}
                </Badge>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="h-3 w-3" /> Check-in
                  </p>
                  <p className="text-sm font-medium">{formatDate(booking.checkInDate)}</p>
                  {booking.checkInTime && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3 inline mr-1" />After {booking.checkInTime}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="h-3 w-3" /> Check-out
                  </p>
                  <p className="text-sm font-medium">{formatDate(booking.checkOutDate)}</p>
                  {booking.checkOutTime && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3 inline mr-1" />Before {booking.checkOutTime}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span>{booking.totalNights} {booking.totalNights === 1 ? "night" : "nights"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Guests</span>
                <span>{booking.numberOfGuests}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment method</span>
                <span className="capitalize">{(booking.paymentMethod || "").replace(/_/g, " ")}</span>
              </div>

              <Separator />

              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>AED {Number(booking.totalAmount).toLocaleString()}</span>
              </div>

              {booking.expiresAt && booking.status === "requested" && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                  <p className="text-amber-800 dark:text-amber-200">
                    <Clock className="h-4 w-4 inline mr-1" />
                    This booking request expires in 24 hours if not confirmed by the property manager.
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Booking reference: <span className="font-mono">{booking.id.slice(0, 8).toUpperCase()}</span>
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {user && (
            <Button onClick={() => navigate("/portal/my-bookings")}>
              View My Bookings <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate("/")}>
            <Home className="h-4 w-4 mr-2" /> Back to Home
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
