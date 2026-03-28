import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  MapPin,
  Users,
  Moon,
  Key,
  XCircle,
  Star,
  Search,
  Home,
  Clock,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface BookingSummary {
  id: string;
  status: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  totalNights: number;
  totalAmount: number;
  securityDepositAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  propertyName: string;
  propertyCity: string;
  propertyId: string;
  coverPhoto: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  accessPin: string | null;
  cancellationPolicy: string | null;
  createdAt: string;
}

interface BookingDetail {
  id: string;
  status: string;
  propertyId: string;
  propertyName: string;
  propertyCity: string;
  propertyType: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  totalNights: number;
  weekdayNights: number;
  weekendNights: number;
  nightlyRate: number;
  weekendRate: number;
  subtotal: number;
  cleaningFee: number;
  tourismTax: number;
  vat: number;
  securityDepositAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  cancellationPolicy: string | null;
  accessPin: string | null;
  smartHome: boolean;
  guestName: string;
  guestEmail: string;
  pmName: string;
  source: string;
  commissionAmount: number;
  bankAccountBelongsTo: string | null;
  ownerPayoutStatus: string | null;
  specialRequests: string | null;
  declineReason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type BookingStatus =
  | "requested"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "completed"
  | "cancelled"
  | "declined"
  | "expired";

const STATUS_STYLES: Record<BookingStatus, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  checked_in: "bg-green-100 text-green-800",
  checked_out: "bg-orange-100 text-orange-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
  declined: "bg-gray-100 text-gray-800",
  expired: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
  expired: "Expired",
};

function formatDateRange(checkIn: string, checkOut: string): string {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const sameYear = start.getFullYear() === end.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", sameYear ? opts : { ...opts, year: "numeric" });
  return `${startStr} - ${endStr}, ${end.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "AED" }).format(amount);
}

function isFutureDate(dateStr: string): boolean {
  return new Date(dateStr) >= new Date(new Date().toDateString());
}

// ── Filter logic ───────────────────────────────────────────────────────────────

type FilterTab = "all" | "upcoming" | "past" | "other";

function filterBookings(bookings: BookingSummary[], tab: FilterTab): BookingSummary[] {
  switch (tab) {
    case "upcoming":
      return bookings.filter(
        (b) =>
          (b.status === "confirmed" || b.status === "checked_in" || b.status === "requested") &&
          isFutureDate(b.checkInDate)
      );
    case "past":
      return bookings.filter(
        (b) => b.status === "completed" || b.status === "checked_out"
      );
    case "other":
      return bookings.filter(
        (b) => b.status === "cancelled" || b.status === "declined" || b.status === "expired"
      );
    default:
      return bookings;
  }
}

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status as BookingStatus;
  return (
    <Badge
      className={cn(
        "border-0 font-medium",
        STATUS_STYLES[s] ?? "bg-gray-100 text-gray-800"
      )}
    >
      {STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MyBookings() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingSummary | null>(null);

  // Fetch all bookings
  const {
    data: bookings = [],
    isLoading,
  } = useQuery<BookingSummary[]>({
    queryKey: ["/bookings/my"],
    queryFn: () => api.get<BookingSummary[]>("/bookings/my"),
  });

  // Fetch single booking detail when dialog opens
  const {
    data: detail,
    isLoading: detailLoading,
  } = useQuery<BookingDetail>({
    queryKey: ["/bookings", selectedId],
    queryFn: () => api.get<BookingDetail>(`/bookings/${selectedId}`),
    enabled: !!selectedId,
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/cancel`),
    onSuccess: () => {
      toast({ title: "Booking cancelled", description: "Your booking has been cancelled." });
      queryClient.invalidateQueries({ queryKey: ["/bookings/my"] });
      queryClient.invalidateQueries({ queryKey: ["/bookings", cancelTarget?.id] });
      setCancelTarget(null);
      setSelectedId(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
    },
  });

  const filtered = filterBookings(bookings, tab);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">My Bookings</h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["all", "All"],
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["other", "Cancelled / Declined / Expired"],
          ] as [FilterTab, string][]
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={tab === key ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-24 w-32 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-5 w-20 ml-auto" />
                    <Skeleton className="h-4 w-24 ml-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarDays className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold mb-1">No bookings yet</h2>
          <p className="text-muted-foreground mb-6">
            {tab === "all"
              ? "You haven't made any bookings. Start exploring properties!"
              : "No bookings match this filter."}
          </p>
          {tab === "all" && (
            <Button onClick={() => setLocation("/search")}>
              <Search className="h-4 w-4 mr-2" />
              Browse Properties
            </Button>
          )}
        </div>
      )}

      {/* Booking cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((booking) => (
            <Card
              key={booking.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedId(booking.id)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Cover photo */}
                  <div className="shrink-0">
                    {booking.coverPhoto ? (
                      <img
                        src={booking.coverPhoto}
                        alt={booking.propertyName}
                        className="h-24 w-32 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-24 w-32 rounded-lg bg-muted flex items-center justify-center">
                        <Home className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Middle info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">
                      {booking.propertyName}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {booking.propertyCity}
                    </p>
                    <p className="text-sm mt-1.5 flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDateRange(booking.checkInDate, booking.checkOutDate)}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {booking.numberOfGuests} guest{booking.numberOfGuests !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Moon className="h-3.5 w-3.5" />
                        {booking.totalNights} night{booking.totalNights !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end justify-between shrink-0">
                    <StatusBadge status={booking.status} />
                    <p className="font-semibold text-lg mt-2">
                      {formatCurrency(booking.totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Action buttons row */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                  {booking.status === "requested" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setCancelTarget(booking)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel Request
                    </Button>
                  )}

                  {booking.status === "confirmed" && (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setCancelTarget(booking)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel Booking
                      </Button>
                      {booking.accessPin && (
                        <span className="ml-auto flex items-center gap-1 text-sm font-mono bg-green-50 text-green-700 px-3 py-1 rounded-md">
                          <Key className="h-3.5 w-3.5" />
                          PIN: {booking.accessPin}
                        </span>
                      )}
                    </>
                  )}

                  {booking.status === "checked_in" && booking.accessPin && (
                    <span className="flex items-center gap-1 text-sm font-mono bg-green-50 text-green-700 px-3 py-1 rounded-md">
                      <Key className="h-4 w-4" />
                      Access PIN: {booking.accessPin}
                    </span>
                  )}

                  {booking.status === "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/portal/review/${booking.id}`)}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Leave Review
                    </Button>
                  )}

                  {booking.status === "cancelled" && (
                    <p className="text-sm text-muted-foreground">This booking was cancelled.</p>
                  )}

                  {booking.status === "declined" && (
                    <p className="text-sm text-muted-foreground">This booking was declined by the host.</p>
                  )}

                  {booking.status === "expired" && (
                    <p className="text-sm text-muted-foreground">This booking request has expired.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Booking Detail Dialog ──────────────────────────────────────────── */}
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
              {/* Property */}
              <div>
                <h3 className="font-semibold text-lg">{detail.propertyName}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {detail.propertyCity}
                  {detail.propertyType && ` \u00B7 ${detail.propertyType}`}
                </p>
                <div className="mt-2">
                  <StatusBadge status={detail.status} />
                </div>
              </div>

              <Separator />

              {/* Trip dates */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-0.5">Check-in</p>
                  <p className="font-medium">
                    {new Date(detail.checkInDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  {detail.checkInTime && (
                    <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {detail.checkInTime}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Check-out</p>
                  <p className="font-medium">
                    {new Date(detail.checkOutDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  {detail.checkOutTime && (
                    <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {detail.checkOutTime}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {detail.numberOfGuests} guest{detail.numberOfGuests !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  {detail.totalNights} night{detail.totalNights !== 1 ? "s" : ""}
                </span>
              </div>

              <Separator />

              {/* Price breakdown */}
              <div>
                <h4 className="font-semibold mb-2">Price Breakdown</h4>
                <div className="space-y-1.5 text-sm">
                  {detail.weekdayNights > 0 && (
                    <div className="flex justify-between">
                      <span>
                        {formatCurrency(detail.nightlyRate)} x {detail.weekdayNights} weekday night
                        {detail.weekdayNights !== 1 ? "s" : ""}
                      </span>
                      <span>{formatCurrency(detail.nightlyRate * detail.weekdayNights)}</span>
                    </div>
                  )}
                  {detail.weekendNights > 0 && (
                    <div className="flex justify-between">
                      <span>
                        {formatCurrency(detail.weekendRate)} x {detail.weekendNights} weekend night
                        {detail.weekendNights !== 1 ? "s" : ""}
                      </span>
                      <span>{formatCurrency(detail.weekendRate * detail.weekendNights)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(detail.subtotal)}</span>
                  </div>
                  {detail.cleaningFee > 0 && (
                    <div className="flex justify-between">
                      <span>Cleaning fee</span>
                      <span>{formatCurrency(detail.cleaningFee)}</span>
                    </div>
                  )}
                  {detail.tourismTax > 0 && (
                    <div className="flex justify-between">
                      <span>Tourism tax</span>
                      <span>{formatCurrency(detail.tourismTax)}</span>
                    </div>
                  )}
                  {detail.vat > 0 && (
                    <div className="flex justify-between">
                      <span>VAT</span>
                      <span>{formatCurrency(detail.vat)}</span>
                    </div>
                  )}
                  {detail.securityDepositAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Security deposit</span>
                      <span>{formatCurrency(detail.securityDepositAmount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-base pt-1">
                    <span>Total</span>
                    <span>{formatCurrency(detail.totalAmount)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payment */}
              <div className="text-sm space-y-1">
                <h4 className="font-semibold mb-2">Payment</h4>
                <div className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span>Method: {detail.paymentMethod ?? "N/A"}</span>
                </div>
                <p>Status: {detail.paymentStatus ?? "N/A"}</p>
              </div>

              {/* Cancellation policy */}
              {detail.cancellationPolicy && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <h4 className="font-semibold mb-1 flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      Cancellation Policy
                    </h4>
                    <p className="text-muted-foreground">{detail.cancellationPolicy}</p>
                  </div>
                </>
              )}

              {/* Access pin */}
              {detail.smartHome && detail.accessPin && detail.status === "checked_in" && (
                <>
                  <Separator />
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                    <Key className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800 text-sm">Access PIN</p>
                      <p className="font-mono text-lg text-green-700">{detail.accessPin}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Special requests */}
              {detail.specialRequests && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <h4 className="font-semibold mb-1">Special Requests</h4>
                    <p className="text-muted-foreground">{detail.specialRequests}</p>
                  </div>
                </>
              )}

              {/* Decline reason */}
              {detail.status === "declined" && detail.declineReason && (
                <>
                  <Separator />
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-red-800 mb-0.5">Decline Reason</p>
                    <p className="text-red-700">{detail.declineReason}</p>
                  </div>
                </>
              )}

              {/* Expiry warning */}
              {detail.status === "requested" && detail.expiresAt && (
                <>
                  <Separator />
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-yellow-800">Request expires</p>
                      <p className="text-yellow-700">
                        {new Date(detail.expiresAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* PM name */}
              {detail.pmName && (
                <p className="text-sm text-muted-foreground">
                  Managed by <span className="font-medium text-foreground">{detail.pmName}</span>
                </p>
              )}

              {/* Cancel from detail dialog */}
              {(detail.status === "requested" || detail.status === "confirmed") && (
                <>
                  <Separator />
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      const summary = bookings.find((b) => b.id === detail.id);
                      if (summary) setCancelTarget(summary);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {detail.status === "requested" ? "Cancel Request" : "Cancel Booking"}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirmation Dialog ─────────────────────────────────────── */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your booking at{" "}
              <span className="font-semibold">{cancelTarget?.propertyName}</span> for{" "}
              {cancelTarget && formatDateRange(cancelTarget.checkInDate, cancelTarget.checkOutDate)}?
            </DialogDescription>
          </DialogHeader>

          {cancelTarget?.cancellationPolicy && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-yellow-800 mb-0.5">Cancellation Policy</p>
                <p className="text-yellow-700">{cancelTarget.cancellationPolicy}</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
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
