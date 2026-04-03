import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { XCircle, Loader2, Ban, Building, CalendarDays, Users, Mail, Phone, CreditCard, DollarSign, MapPin, Clock, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Cancellation {
  id: string;
  status: "cancelled" | "declined";
  checkIn: string;
  checkOut: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  refundAmount: string | null;
  totalAmount: string | null;
  currency: string | null;
  propertyName: string;
  guestName: string | null;
}

type FilterTab = "all" | "cancelled" | "declined";

function formatDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(amount: string | null, currency: string | null) {
  if (!amount || amount === "0") return "\u2014";
  return `${currency || "AED"} ${parseFloat(amount).toFixed(2)}`;
}

export default function StCancellations() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: cancellations = [], isLoading } = useQuery<Cancellation[]>({
    queryKey: ["/bookings/cancellations"],
    queryFn: () => api.get("/bookings/cancellations"),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/bookings", selectedId],
    queryFn: () => api.get(`/bookings/${selectedId}`),
    enabled: !!selectedId,
  });

  const filtered = filter === "all"
    ? cancellations
    : cancellations.filter((c) => c.status === filter);

  const cancelledCount = cancellations.filter((c) => c.status === "cancelled").length;
  const declinedCount = cancellations.filter((c) => c.status === "declined").length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <XCircle className="h-6 w-6" /> Cancellations
        </h1>
        <p className="text-muted-foreground mt-1">
          Cancelled and declined bookings across all properties
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([
          { key: "all" as FilterTab, label: "All", count: cancellations.length },
          { key: "cancelled" as FilterTab, label: "Cancelled", count: cancelledCount },
          { key: "declined" as FilterTab, label: "Declined", count: declinedCount },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <XCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No {filter === "all" ? "cancellations or declines" : filter === "cancelled" ? "cancellations" : "declined bookings"} found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isCancelled = item.status === "cancelled";
            const reason = isCancelled ? item.cancellationReason : item.declineReason;
            const actionDate = isCancelled ? item.cancelledAt : item.declinedAt;

            return (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedId(item.id)}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          <Building className="h-3 w-3 mr-1" />
                          {item.propertyName}
                        </Badge>
                        <Badge
                          variant={isCancelled ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {isCancelled ? (
                            <XCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <Ban className="h-3 w-3 mr-1" />
                          )}
                          {isCancelled ? "Cancelled" : "Declined"}
                        </Badge>
                      </div>

                      <p className="text-sm">
                        <span className="font-medium">{item.guestName || "Guest"}</span>
                        <span className="text-muted-foreground mx-2">|</span>
                        <span className="text-muted-foreground">
                          {formatDate(item.checkIn)} &rarr; {formatDate(item.checkOut)}
                        </span>
                      </p>

                      {reason && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Reason:</span> {reason}
                        </p>
                      )}
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-3">
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {isCancelled ? "Cancelled" : "Declined"} {formatDate(actionDate)}
                        </p>
                        {item.refundAmount && item.refundAmount !== "0" && (
                          <p className="text-sm font-medium">
                            Refund: {formatCurrency(item.refundAmount, item.currency)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Booking Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Property & Status */}
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg">{detail.propertyName}</h3>
                </div>
                <div className="mt-2">
                  <Badge variant={detail.status === "cancelled" ? "destructive" : "secondary"}>
                    {detail.status === "cancelled" ? "Cancelled" : "Declined"}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Trip Dates */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-0.5 flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> Check-in
                  </p>
                  <p className="font-medium">{formatDate(detail.checkInDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5 flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> Check-out
                  </p>
                  <p className="font-medium">{formatDate(detail.checkOutDate)}</p>
                </div>
              </div>

              <Separator />

              {/* Guest Info */}
              <div className="space-y-2 text-sm">
                <h4 className="font-semibold flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Guest
                </h4>
                <div className="grid gap-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{detail.guestName || "Unknown"}</span>
                  </div>
                  {detail.guestEmail && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
                      <span className="font-medium">{detail.guestEmail}</span>
                    </div>
                  )}
                  {detail.guestPhone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span>
                      <span className="font-medium">{detail.guestPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guests</span>
                    <span className="font-medium">{detail.numberOfGuests}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Financials */}
              <div className="space-y-2 text-sm">
                <h4 className="font-semibold flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" /> Financials
                </h4>
                <div className="grid gap-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-medium">AED {parseFloat(detail.totalAmount || "0").toFixed(2)}</span>
                  </div>
                  {detail.refundAmount && detail.refundAmount !== "0" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Refund</span>
                      <span className="font-medium text-green-600">AED {parseFloat(detail.refundAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {detail.paymentMethod && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Payment</span>
                      <span className="font-medium capitalize">{detail.paymentMethod}</span>
                    </div>
                  )}
                  {detail.paymentStatus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Status</span>
                      <span className="font-medium capitalize">{detail.paymentStatus}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Cancellation / Decline Info */}
              <div className="space-y-2 text-sm">
                <h4 className="font-semibold flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> {detail.status === "cancelled" ? "Cancellation" : "Decline"} Details
                </h4>
                <div className="grid gap-1.5">
                  {detail.cancellationReason && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reason</span>
                      <span className="font-medium">{detail.cancellationReason}</span>
                    </div>
                  )}
                  {detail.declineReason && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reason</span>
                      <span className="font-medium">{detail.declineReason}</span>
                    </div>
                  )}
                  {detail.cancelledAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Cancelled at</span>
                      <span className="font-medium">{formatDate(detail.cancelledAt)}</span>
                    </div>
                  )}
                  {detail.declinedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Declined at</span>
                      <span className="font-medium">{formatDate(detail.declinedAt)}</span>
                    </div>
                  )}
                  {detail.cancellationPolicy && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Policy</span>
                      <span className="font-medium capitalize">{detail.cancellationPolicy}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Requests */}
              {detail.specialRequests && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <h4 className="font-semibold mb-1">Special Requests</h4>
                    <p className="text-muted-foreground">{detail.specialRequests}</p>
                  </div>
                </>
              )}

              {/* Created */}
              <Separator />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Booked on {formatDate(detail.createdAt)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
