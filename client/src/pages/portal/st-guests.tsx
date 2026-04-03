import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Contact,
  Search,
  Loader2,
  Mail,
  Phone,
  Globe,
  CalendarDays,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Building,
  Star,
  ShieldCheck,
  Users,
  CreditCard,
} from "lucide-react";

interface GuestSummary {
  userId: string;
  name: string | null;
  email: string;
  phone: string | null;
  nationality: string | null;
  kycStatus: string | null;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  activeBookings: number;
  totalSpent: string;
  firstBooking: string | null;
  lastBooking: string | null;
  lastActivity: string;
}

interface GuestProfile {
  id: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  fullName: string | null;
  dob: string | null;
  nationality: string | null;
  countryOfResidence: string | null;
  residentAddress: string | null;
  emiratesIdNumber: string | null;
  emiratesIdExpiry: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  kycStatus: string | null;
}

interface GuestBooking {
  id: string;
  status: string;
  source: string | null;
  checkIn: string;
  checkOut: string;
  totalNights: number;
  numberOfGuests: number;
  totalAmount: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  commissionType: string | null;
  commissionAmount: string | null;
  specialRequests: string | null;
  cancellationReason: string | null;
  declineReason: string | null;
  createdAt: string;
  propertyId: string;
  propertyName: string;
  buildingName: string | null;
  unitNumber: string | null;
  coverPhoto: string | null;
  reviewRating: number | null;
}

function formatDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(v: string | number | null) {
  if (v == null) return "AED 0";
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(num)) return "AED 0";
  return `AED ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  requested: { label: "Requested", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800" },
  checked_in: { label: "Checked In", color: "bg-green-100 text-green-800" },
  checked_out: { label: "Checked Out", color: "bg-orange-100 text-orange-800" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
  declined: { label: "Declined", color: "bg-gray-100 text-gray-800" },
};

const KYC_STYLES: Record<string, { label: string; color: string }> = {
  verified: { label: "Verified", color: "bg-green-100 text-green-800" },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
};

export default function StGuests() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  const { data: guests = [], isLoading } = useQuery<GuestSummary[]>({
    queryKey: ["/bookings/guests"],
    queryFn: () => api.get("/bookings/guests"),
  });

  const { data: guestHistory, isLoading: historyLoading } = useQuery<{ guest: GuestProfile; bookings: GuestBooking[] }>({
    queryKey: ["/bookings/guests", selectedGuestId, "history"],
    queryFn: () => api.get(`/bookings/guests/${selectedGuestId}/history`),
    enabled: !!selectedGuestId,
  });

  const filtered = guests.filter((g) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (g.name || "").toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      (g.phone || "").includes(q) ||
      (g.nationality || "").toLowerCase().includes(q)
    );
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Contact className="h-6 w-6" /> Guests
          </h1>
          <p className="text-muted-foreground mt-1">
            All guests who have booked your properties
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {guests.length} guest{guests.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone, nationality..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Guest List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <Contact className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>{searchQuery ? "No guests match your search." : "No guests have booked yet."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2.5 font-medium">Guest</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">KYC</th>
                <th className="px-4 py-2.5 font-medium text-center">Bookings</th>
                <th className="px-4 py-2.5 font-medium text-right">Total Spent</th>
                <th className="px-4 py-2.5 font-medium">Last Booking</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const kyc = KYC_STYLES[g.kycStatus || ""] || { label: g.kycStatus || "N/A", color: "bg-gray-100 text-gray-700" };
                return (
                  <tr
                    key={g.userId}
                    className="border-t hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedGuestId(g.userId)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{g.name || "Unknown"}</p>
                      {g.nationality && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Globe className="h-3 w-3" /> {g.nationality}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" /> {g.email}
                      </p>
                      {g.phone && (
                        <p className="text-xs flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-muted-foreground" /> {g.phone}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] border-0 ${kyc.color}`}>{kyc.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-semibold">{g.totalBookings}</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({g.completedBookings} done
                          {g.activeBookings > 0 && `, ${g.activeBookings} active`}
                          {g.cancelledBookings > 0 && `, ${g.cancelledBookings} cancelled`})
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(g.totalSpent)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(g.lastBooking)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={(e) => { e.stopPropagation(); setSelectedGuestId(g.userId); }}
                      >
                        View History
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Guest History Dialog */}
      <Dialog open={!!selectedGuestId} onOpenChange={(open) => !open && setSelectedGuestId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Contact className="h-5 w-5" />
              Guest Profile & Booking History
            </DialogTitle>
          </DialogHeader>

          {historyLoading || !guestHistory ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile Card */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{guestHistory.guest.fullName || "Unknown Guest"}</h3>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {guestHistory.guest.email && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" /> {guestHistory.guest.email}
                          </span>
                        )}
                        {guestHistory.guest.phone && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" /> {guestHistory.guest.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={`text-xs border-0 ${KYC_STYLES[guestHistory.guest.kycStatus || ""]?.color || "bg-gray-100 text-gray-700"}`}>
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      KYC: {KYC_STYLES[guestHistory.guest.kycStatus || ""]?.label || guestHistory.guest.kycStatus || "N/A"}
                    </Badge>
                  </div>

                  <Separator className="my-3" />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {guestHistory.guest.nationality && (
                      <div>
                        <p className="text-muted-foreground text-xs">Nationality</p>
                        <p className="font-medium">{guestHistory.guest.nationality}</p>
                      </div>
                    )}
                    {guestHistory.guest.countryOfResidence && (
                      <div>
                        <p className="text-muted-foreground text-xs">Residence</p>
                        <p className="font-medium">{guestHistory.guest.countryOfResidence}</p>
                      </div>
                    )}
                    {guestHistory.guest.passportNumber && (
                      <div>
                        <p className="text-muted-foreground text-xs">Passport</p>
                        <p className="font-medium">{guestHistory.guest.passportNumber}</p>
                      </div>
                    )}
                    {guestHistory.guest.registeredAt && (
                      <div>
                        <p className="text-muted-foreground text-xs">Registered</p>
                        <p className="font-medium">{formatDate(guestHistory.guest.registeredAt)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-primary">{guestHistory.bookings.length}</p>
                    <p className="text-xs text-muted-foreground">Total Bookings</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">
                      {formatCurrency(
                        guestHistory.bookings
                          .filter((b) => ["confirmed", "checked_in", "checked_out", "completed"].includes(b.status))
                          .reduce((sum, b) => sum + parseFloat(b.totalAmount || "0"), 0)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {guestHistory.bookings.filter((b) => b.reviewRating).length > 0
                        ? (guestHistory.bookings.filter((b) => b.reviewRating).reduce((sum, b) => sum + (b.reviewRating || 0), 0) /
                            guestHistory.bookings.filter((b) => b.reviewRating).length).toFixed(1)
                        : "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                  </CardContent>
                </Card>
              </div>

              {/* Booking History */}
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" /> Booking History
                </h4>
                <div className="space-y-3">
                  {guestHistory.bookings.map((b) => {
                    const statusInfo = STATUS_STYLES[b.status] || { label: b.status, color: "bg-gray-100 text-gray-700" };
                    return (
                      <Card key={b.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3 flex-1">
                              {/* Cover photo */}
                              <div className="w-16 h-16 rounded-lg bg-muted shrink-0 overflow-hidden">
                                {b.coverPhoto ? (
                                  <img src={b.coverPhoto} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Building className="h-6 w-6 text-muted-foreground/40" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm truncate">{b.propertyName}</p>
                                  <Badge className={`text-[10px] border-0 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {[b.buildingName, b.unitNumber ? `Unit ${b.unitNumber}` : null].filter(Boolean).join(", ")}
                                </p>
                                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <CalendarDays className="h-3 w-3" />
                                    {formatDate(b.checkIn)} - {formatDate(b.checkOut)} ({b.totalNights} night{b.totalNights !== 1 ? "s" : ""})
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {b.numberOfGuests} guest{b.numberOfGuests !== 1 ? "s" : ""}
                                  </span>
                                  {b.source && b.source !== "website" && (
                                    <span className="capitalize">{b.source.replace("_", ".")}</span>
                                  )}
                                </div>
                                {b.specialRequests && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">"{b.specialRequests}"</p>
                                )}
                                {(b.cancellationReason || b.declineReason) && (
                                  <p className="text-xs text-red-600 mt-1">
                                    Reason: {b.cancellationReason || b.declineReason}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right side - amount */}
                            <div className="text-right shrink-0">
                              <p className="font-semibold">{formatCurrency(b.totalAmount)}</p>
                              {b.paymentStatus && (
                                <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{b.paymentStatus}</p>
                              )}
                              {b.reviewRating && (
                                <div className="flex items-center justify-end gap-0.5 mt-1">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  <span className="text-xs font-medium">{b.reviewRating}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
