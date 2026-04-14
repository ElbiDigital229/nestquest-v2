import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookingStatusBadge } from "@/components/status-badge";
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
  CheckCircle,
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
  pricingBreakdown: { date: string; price: number; type: string }[];
  securityDeposit: {
    amount: string;
    status: string;
    returnedAmount: string | null;
    returnedAt: string | null;
    deductions: { reason: string; amount: string }[];
    notes: string | null;
  } | null;
  ownerPayoutStatus: string | null;
  settlementStatus: string | null;
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

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MyBookings({ propertyId, embedded }: { propertyId?: string; embedded?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isPmOrTeam = user?.role === "PROPERTY_MANAGER" || user?.role === "PM_TEAM_MEMBER";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get("id"); } catch { return null; }
  });
  const [cancelTarget, setCancelTarget] = useState<BookingSummary | null>(null);
  const [depositTarget, setDepositTarget] = useState<BookingSummary | null>(null);
  const [depositReturnAmount, setDepositReturnAmount] = useState("");
  const [depositDeductionReason, setDepositDeductionReason] = useState("");
  const [depositDeductionAmount, setDepositDeductionAmount] = useState("");

  // Fetch bookings — all or filtered by property
  const queryKey = propertyId ? ["/bookings/property", propertyId] : ["/bookings/my"];
  const {
    data: bookings = [],
    isLoading,
  } = useQuery<BookingSummary[]>({
    queryKey,
    queryFn: () => propertyId
      ? api.get<BookingSummary[]>(`/bookings/property/${propertyId}`)
      : api.get<BookingSummary[]>("/bookings/my"),
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
      queryClient.invalidateQueries({ queryKey });
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
      {!embedded && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">My Bookings</h1>
          </div>
        </div>
      )}

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

      {/* Summary bar */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            const totalReceived = filtered.reduce((s, b) => s + Number(b.totalAmount || 0), 0);
            const totalDeposits = filtered.reduce((s, b) => s + Number(b.securityDepositAmount || 0), 0);
            const revenue = totalReceived - totalDeposits;
            return (
              <>
                <div className="rounded-lg border p-3 bg-emerald-50/50">
                  <p className="text-[10px] text-muted-foreground">Rental Revenue</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(revenue)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-amber-50/50">
                  <p className="text-[10px] text-muted-foreground">Security Deposits</p>
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(totalDeposits)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-blue-50/50">
                  <p className="text-[10px] text-muted-foreground">Total Received</p>
                  <p className="text-lg font-bold text-blue-700">{formatCurrency(totalReceived)}</p>
                </div>
                <div className="rounded-lg border p-3 bg-purple-50/50">
                  <p className="text-[10px] text-muted-foreground">Bookings</p>
                  <p className="text-lg font-bold text-purple-700">{filtered.length}</p>
                </div>
              </>
            );
          })()}
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
                    <BookingStatusBadge status={booking.status} />
                    <p className="font-semibold text-lg mt-2">
                      {formatCurrency(booking.totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Action buttons row */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                  {booking.status === "requested" && isPmOrTeam && (
                    <>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await api.patch(`/bookings/${booking.id}/confirm`);
                          queryClient.invalidateQueries({ queryKey });
                          queryClient.invalidateQueries({ queryKey: ["bookings"] });
                          toast({ title: "Booking confirmed" });
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Confirm
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          await api.patch(`/bookings/${booking.id}/decline`, { reason: "Declined by PM" });
                          queryClient.invalidateQueries({ queryKey });
                          queryClient.invalidateQueries({ queryKey: ["bookings"] });
                          toast({ title: "Booking declined" });
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </>
                  )}
                  {booking.status === "requested" && !isPmOrTeam && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setCancelTarget(booking)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel Request
                    </Button>
                  )}

                  {booking.status === "confirmed" && isPmOrTeam && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        const res = await api.patch(`/bookings/${booking.id}/check-in`, { notes: "" });
                        queryClient.invalidateQueries({ queryKey });
                        queryClient.invalidateQueries({ queryKey: ["bookings"] });
                        toast({ title: `Checked in${(res as any).accessPin ? ` — PIN: ${(res as any).accessPin}` : ""}` });
                      }}
                    >
                      <Key className="h-4 w-4 mr-1" />
                      Check In
                    </Button>
                  )}
                  {booking.status === "checked_in" && isPmOrTeam && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await api.patch(`/bookings/${booking.id}/check-out`, { notes: "" });
                        queryClient.invalidateQueries({ queryKey });
                        queryClient.invalidateQueries({ queryKey: ["bookings"] });
                        toast({ title: "Guest checked out" });
                      }}
                    >
                      Check Out
                    </Button>
                  )}
                  {booking.status === "checked_out" && isPmOrTeam && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await api.patch(`/bookings/${booking.id}/complete`);
                        queryClient.invalidateQueries({ queryKey });
                        queryClient.invalidateQueries({ queryKey: ["bookings"] });
                        toast({ title: "Booking completed" });
                      }}
                    >
                      Complete
                    </Button>
                  )}
                  {(() => {
                    const ds = (booking as any).depositStatus;
                    const isProcessed = ds === "returned" || ds === "partially_returned" || ds === "forfeited";
                    if (["checked_out", "completed"].includes(booking.status) && isPmOrTeam && booking.securityDepositAmount > 0) {
                      if (isProcessed) {
                        return <span className="text-xs text-green-600">Deposit processed</span>;
                      }
                      return (
                        <Button size="sm" variant="outline" onClick={() => setDepositTarget(booking)}>
                          Return Deposit
                        </Button>
                      );
                    }
                    return null;
                  })()}
                  {booking.status === "completed" && isPmOrTeam && (() => {
                    const ss = (booking as any).settlementStatus;
                    if (ss === "confirmed" || ss === "paid") {
                      return <span className="text-xs text-green-600">Settled with PO</span>;
                    }
                    return (
                      <Button size="sm" variant="outline" onClick={() => setLocation("/portal/settlements")}>
                        Settle with PO
                      </Button>
                    );
                  })()}
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

                  {(booking.status === "completed" || booking.status === "checked_out") && user?.role === "GUEST" && !(booking as any).reviewId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/portal/review/${booking.id}`)}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Leave Review
                    </Button>
                  )}
                  {(booking as any).reviewId && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> Reviewed
                    </span>
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
                  <BookingStatusBadge status={detail.status} />
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

              {/* Guest Profile (PM/PO only) */}
              {(detail as any).guestProfile && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Guest Details</h4>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div><p className="text-muted-foreground text-xs">Full Name</p><p className="font-medium">{(detail as any).guestProfile.fullName}</p></div>
                        <div><p className="text-muted-foreground text-xs">Email</p><p className="font-medium">{(detail as any).guestProfile.email}</p></div>
                        <div><p className="text-muted-foreground text-xs">Phone</p><p className="font-medium">{(detail as any).guestProfile.phone || "—"}</p></div>
                        <div><p className="text-muted-foreground text-xs">Nationality</p><p className="font-medium">{(detail as any).guestProfile.nationality}</p></div>
                        <div><p className="text-muted-foreground text-xs">Country</p><p className="font-medium">{(detail as any).guestProfile.countryOfResidence}</p></div>
                        <div><p className="text-muted-foreground text-xs">DOB</p><p className="font-medium">{(detail as any).guestProfile.dob ? new Date((detail as any).guestProfile.dob).toLocaleDateString("en-GB") : "—"}</p></div>
                      </div>

                      <Separator />
                      <p className="text-xs font-semibold text-muted-foreground">IDENTIFICATION</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><p className="text-muted-foreground text-xs">Emirates ID</p><p className="font-medium">{(detail as any).guestProfile.emiratesIdNumber || "—"}</p></div>
                        <div><p className="text-muted-foreground text-xs">EID Expiry</p><p className="font-medium">{(detail as any).guestProfile.emiratesIdExpiry ? new Date((detail as any).guestProfile.emiratesIdExpiry).toLocaleDateString("en-GB") : "—"}</p></div>
                        <div><p className="text-muted-foreground text-xs">Passport</p><p className="font-medium">{(detail as any).guestProfile.passportNumber || "—"}</p></div>
                        <div><p className="text-muted-foreground text-xs">Passport Expiry</p><p className="font-medium">{(detail as any).guestProfile.passportExpiry ? new Date((detail as any).guestProfile.passportExpiry).toLocaleDateString("en-GB") : "—"}</p></div>
                      </div>

                      {/* ID Images */}
                      <div className="flex gap-3 flex-wrap">
                        {(detail as any).guestProfile.emiratesIdFrontUrl && (
                          <a href={(detail as any).guestProfile.emiratesIdFrontUrl} target="_blank" rel="noopener">
                            <img src={(detail as any).guestProfile.emiratesIdFrontUrl} alt="EID Front" className="h-16 rounded border hover:opacity-80" />
                          </a>
                        )}
                        {(detail as any).guestProfile.emiratesIdBackUrl && (
                          <a href={(detail as any).guestProfile.emiratesIdBackUrl} target="_blank" rel="noopener">
                            <img src={(detail as any).guestProfile.emiratesIdBackUrl} alt="EID Back" className="h-16 rounded border hover:opacity-80" />
                          </a>
                        )}
                        {(detail as any).guestProfile.passportFrontUrl && (
                          <a href={(detail as any).guestProfile.passportFrontUrl} target="_blank" rel="noopener">
                            <img src={(detail as any).guestProfile.passportFrontUrl} alt="Passport" className="h-16 rounded border hover:opacity-80" />
                          </a>
                        )}
                      </div>

                      {/* KYC Status */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">KYC Status:</span>
                        <Badge className={`text-[10px] border-0 ${
                          (detail as any).guestProfile.kycStatus === "verified" ? "bg-green-100 text-green-800" :
                          (detail as any).guestProfile.kycStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }`}>{(detail as any).guestProfile.kycStatus}</Badge>
                      </div>

                      {/* Documents */}
                      {(detail as any).guestProfile.documents?.length > 0 && (
                        <>
                          <Separator />
                          <p className="text-xs font-semibold text-muted-foreground">UPLOADED DOCUMENTS</p>
                          <div className="space-y-1">
                            {(detail as any).guestProfile.documents.map((doc: any) => (
                              <div key={doc.id} className="flex items-center justify-between text-xs">
                                <span>{doc.documentName} {doc.documentNumber ? `(${doc.documentNumber})` : ""}</span>
                                <div className="flex items-center gap-2">
                                  {doc.expiryDate && <span className="text-muted-foreground">Exp: {new Date(doc.expiryDate).toLocaleDateString("en-GB")}</span>}
                                  {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noopener" className="text-primary hover:underline">View</a>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Price breakdown */}
              <div>
                <h4 className="font-semibold mb-2">Price Breakdown</h4>
                <div className="space-y-1.5 text-sm">
                  {detail.pricingBreakdown?.length > 0 ? (
                    (() => {
                      // Group consecutive nights with same price+type into line items
                      const groups: { label: string; count: number; price: number; total: number }[] = [];
                      for (const night of detail.pricingBreakdown) {
                        const label = night.type === "custom"
                          ? `Custom (${new Date(night.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })})`
                          : night.type === "weekend" ? "Weekend night" : "Weekday night";
                        const last = groups[groups.length - 1];
                        if (last && last.price === night.price && last.label === (night.type === "weekend" ? "Weekend night" : night.type === "weekday" ? "Weekday night" : label)) {
                          last.count++;
                          last.total += night.price;
                        } else {
                          groups.push({ label: night.type === "custom" ? `${formatCurrency(night.price)} (${new Date(night.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })})` : night.type === "weekend" ? "Weekend night" : "Weekday night", count: 1, price: night.price, total: night.price });
                        }
                      }
                      return groups.map((g, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground">{formatCurrency(g.price)} × {g.count} {g.count === 1 ? g.label.replace(" night", " night") : g.label + (g.label.endsWith("night") ? "s" : "")}</span>
                          <span>{formatCurrency(g.total)}</span>
                        </div>
                      ));
                    })()
                  ) : (
                    <>
                      {detail.weekdayNights > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{formatCurrency(detail.nightlyRate)} × {detail.weekdayNights} weekday night{detail.weekdayNights !== 1 ? "s" : ""}</span>
                          <span>{formatCurrency(detail.nightlyRate * detail.weekdayNights)}</span>
                        </div>
                      )}
                      {detail.weekendNights > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{formatCurrency(detail.weekendRate)} × {detail.weekendNights} weekend night{detail.weekendNights !== 1 ? "s" : ""}</span>
                          <span>{formatCurrency(detail.weekendRate * detail.weekendNights)}</span>
                        </div>
                      )}
                    </>
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

              {/* Security deposit status — visible to guests */}
              {!isPmOrTeam && detail.securityDepositAmount > 0 && (
                <>
                  <Separator />
                  <div className="text-sm space-y-2">
                    <h4 className="font-semibold flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      Security Deposit
                    </h4>
                    {(() => {
                      const dep = detail.securityDeposit;
                      const status = dep?.status || "held";
                      const statusConfig: Record<string, { label: string; color: string }> = {
                        held:              { label: "Held",             color: "text-amber-600" },
                        pending:           { label: "Held",             color: "text-amber-600" },
                        returned:          { label: "Fully Returned",   color: "text-green-600" },
                        partially_returned:{ label: "Partially Returned", color: "text-blue-600" },
                        forfeited:         { label: "Forfeited",        color: "text-red-600" },
                      };
                      const cfg = statusConfig[status] || statusConfig.held;
                      return (
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-medium">{formatCurrency(Number(dep?.amount ?? detail.securityDepositAmount))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          {dep?.returnedAmount && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Returned</span>
                              <span className="font-medium text-green-600">{formatCurrency(Number(dep.returnedAmount))}</span>
                            </div>
                          )}
                          {dep?.returnedAt && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Return date</span>
                              <span>{new Date(dep.returnedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                          )}
                          {dep?.deductions && dep.deductions.length > 0 && (
                            <div className="mt-2 space-y-1 bg-red-50 rounded p-2">
                              <p className="text-xs font-semibold text-red-700">Deductions</p>
                              {dep.deductions.map((d: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs text-red-700">
                                  <span>{d.reason}</span>
                                  <span>-{formatCurrency(Number(d.amount))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {dep?.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{dep.notes}</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}

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

              {/* Access pin + Lock info */}
              {detail.accessPin && (
                <>
                  <Separator />
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Key className="h-5 w-5 text-green-600" />
                      <p className="font-semibold text-green-800 text-sm">Access PIN</p>
                    </div>
                    <p className="font-mono text-2xl text-green-700 mb-1">{detail.accessPin}</p>
                    {detail.status === "checked_in" && <Badge className="text-[10px] bg-green-100 text-green-800 border-0">Active</Badge>}
                    {(detail.status === "checked_out" || detail.status === "completed") && <Badge className="text-[10px] bg-gray-100 text-gray-600 border-0">Expired</Badge>}
                  </div>
                </>
              )}
              {(detail as any).lockPins?.length > 0 && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <h4 className="font-semibold mb-2">Lock PIN History</h4>
                    <div className="space-y-2">
                      {(detail as any).lockPins.map((lp: any) => (
                        <div key={lp.id} className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <p className="font-mono font-bold text-lg">{lp.pin}</p>
                            <p className="text-xs text-muted-foreground">{lp.lockName} {lp.lockLocation ? `— ${lp.lockLocation}` : ""}</p>
                            <p className="text-xs text-muted-foreground">
                              Valid: {new Date(lp.validFrom).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              {" → "}
                              {new Date(lp.validUntil).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <Badge className={`text-[10px] border-0 ${lp.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{lp.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Review */}
              {(detail.status === "checked_out" || detail.status === "completed") && (
                <ReviewInBooking bookingId={detail.id} />
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
      <CancelDialog
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async (reason: string) => {
          if (!cancelTarget) return;
          try {
            const res = await api.patch(`/bookings/${cancelTarget.id}/cancel`, { reason });
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            const r = res as any;
            toast({ title: `Booking cancelled. Refund: AED ${r.totalRefund}` });
            setCancelTarget(null);
          } catch (err: any) {
            toast({ title: err.message || "Failed to cancel", variant: "destructive" });
          }
        }}
      />

      {/* ── Deposit Return Dialog ─────────────────────────────────────── */}
      <Dialog open={!!depositTarget} onOpenChange={(open) => { if (!open) { setDepositTarget(null); setDepositReturnAmount(""); setDepositDeductionReason(""); setDepositDeductionAmount(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Return Security Deposit</DialogTitle>
            <DialogDescription>
              Deposit held: <span className="font-semibold">AED {Number(depositTarget?.securityDepositAmount || 0).toLocaleString()}</span> for {depositTarget?.propertyName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Return Amount (AED)</label>
              <Input
                type="number"
                value={depositReturnAmount}
                onChange={(e) => setDepositReturnAmount(e.target.value)}
                placeholder={String(depositTarget?.securityDepositAmount || 0)}
                max={Number(depositTarget?.securityDepositAmount || 0)}
              />
            </div>

            {depositReturnAmount && Number(depositReturnAmount) < Number(depositTarget?.securityDepositAmount || 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-amber-800">
                  Deduction: AED {(Number(depositTarget?.securityDepositAmount || 0) - Number(depositReturnAmount)).toFixed(2)}
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Reason for deduction</label>
                  <Input
                    value={depositDeductionReason}
                    onChange={(e) => setDepositDeductionReason(e.target.value)}
                    placeholder="e.g. Broken coffee table"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDepositTarget(null)}>Cancel</Button>
            <Button
              disabled={!depositReturnAmount || Number(depositReturnAmount) < 0}
              onClick={async () => {
                if (!depositTarget) return;
                const returned = Number(depositReturnAmount);
                const original = Number(depositTarget.securityDepositAmount);
                const deductions = returned < original && depositDeductionReason
                  ? [{ reason: depositDeductionReason, amount: (original - returned).toFixed(2) }]
                  : [];
                try {
                  await api.post(`/bookings/${depositTarget.id}/deposit/return`, {
                    returnedAmount: returned, deductions,
                  });
                  queryClient.invalidateQueries({ queryKey });
                  queryClient.invalidateQueries({ queryKey: ["bookings"] });
                  toast({ title: `Deposit returned: AED ${returned.toFixed(2)}${deductions.length ? ` (AED ${deductions[0].amount} deducted)` : ""}` });
                  setDepositTarget(null);
                } catch (err: any) {
                  toast({ title: err.message || "Failed to return deposit", variant: "destructive" });
                }
              }}
            >
              {Number(depositReturnAmount) < Number(depositTarget?.securityDepositAmount || 0)
                ? "Partial Return"
                : "Full Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Cancel Dialog with refund preview ──
function CancelDialog({ booking, onClose, onConfirm }: { booking: any; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: preview } = useQuery<any>({
    queryKey: ["/bookings", booking?.id, "cancel-preview"],
    queryFn: () => api.get(`/bookings/${booking.id}/cancel-preview`),
    enabled: !!booking,
  });

  if (!booking) return null;

  return (
    <Dialog open={!!booking} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            Cancel booking at <span className="font-semibold">{booking.propertyName}</span> for{" "}
            {formatDateRange(booking.checkInDate, booking.checkOutDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cancellation Policy */}
          {booking.cancellationPolicy && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-yellow-800 mb-0.5">Policy: {booking.cancellationPolicy}</p>
              </div>
            </div>
          )}

          {/* Refund Preview */}
          {preview && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Refund Breakdown</p>
              <div className="flex justify-between">
                <span>Rental refund</span>
                <span className="font-medium">AED {Number(preview.rentalRefund).toLocaleString()}</span>
              </div>
              {Number(preview.depositRefund) > 0 && (
                <div className="flex justify-between">
                  <span>Security deposit (full return)</span>
                  <span className="font-medium">AED {Number(preview.depositRefund).toLocaleString()}</span>
                </div>
              )}
              {Number(preview.nonRefundable) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Non-refundable</span>
                  <span className="font-medium">-AED {Number(preview.nonRefundable).toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total Refund</span>
                <span className="text-green-700">AED {Number(preview.totalRefund).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for cancellation <span className="text-destructive">*</span></label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please explain why you're cancelling..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Keep Booking</Button>
          <Button
            variant="destructive"
            disabled={submitting || !reason.trim()}
            onClick={async () => {
              setSubmitting(true);
              await onConfirm(reason);
              setSubmitting(false);
            }}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cancel & Refund AED {preview ? Number(preview.totalRefund).toLocaleString() : "..."}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Review snippet inside booking detail ──
function ReviewInBooking({ bookingId }: { bookingId: string }) {
  const { data: review } = useQuery<any>({
    queryKey: ["/bookings", bookingId, "review"],
    queryFn: () => api.get(`/bookings/${bookingId}/review`).catch(() => null),
  });

  if (!review) return null;

  return (
    <>
      <Separator />
      <div className="text-sm">
        <h4 className="font-semibold mb-2">Your Review</h4>
        <div className="flex gap-0.5 mb-1">
          {[1, 2, 3, 4, 5].map(i => (
            <Star key={i} className={`h-4 w-4 ${i <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
          ))}
        </div>
        {review.title && <p className="font-medium">{review.title}</p>}
        {review.description && <p className="text-muted-foreground mt-1">{review.description}</p>}
        {review.pm_response && (
          <div className="mt-2 bg-muted/50 rounded p-2">
            <p className="text-xs font-semibold text-muted-foreground">PM Response</p>
            <p className="mt-0.5">{review.pm_response}</p>
          </div>
        )}
      </div>
    </>
  );
}
