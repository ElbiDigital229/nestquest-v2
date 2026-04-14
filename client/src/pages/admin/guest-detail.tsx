import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, kycBadgeProps, statusBadgeProps } from "@/lib/role-utils";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  User,
  Users,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Globe,
  CreditCard,
  Building2,
  Home,
  Shield,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  UserCheck,
  LogIn,
  UserPlus,
  Settings,
  Key,
  Clock,
  Activity,
  FileText,
  MessageSquare,
  Pencil,
  X,
  Save,
  UploadCloud,
  TrendingUp,
  Receipt,
  Banknote,
  ExternalLink,
  ZoomIn,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import AdminLinkedUserDialog from "@/components/admin-linked-user-dialog";

// ─── Constants ───────────────────────────────────────────────────────────────

const COUNTRIES = [
  "UAE", "Saudi Arabia", "Oman", "Bahrain", "Qatar", "Kuwait",
  "India", "Pakistan", "Philippines", "United Kingdom", "United States",
  "Canada", "Australia", "Germany", "France", "China", "Egypt",
  "Jordan", "Lebanon", "South Africa", "Nigeria", "Kenya", "Brazil",
  "Russia", "Japan", "South Korea", "Turkey", "Iran", "Iraq", "Syria",
  "Yemen", "Afghanistan", "Bangladesh", "Sri Lanka", "Nepal",
  "Indonesia", "Malaysia", "Singapore", "Thailand", "Vietnam",
  "New Zealand", "Ireland", "Italy", "Spain", "Portugal", "Netherlands",
  "Belgium", "Sweden", "Norway", "Denmark", "Finland", "Switzerland",
  "Austria", "Poland", "Czech Republic", "Romania", "Hungary", "Greece",
  "Argentina", "Chile", "Colombia", "Mexico", "Peru",
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface GuestDetailResponse {
  user: {
    id: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    createdAt: string;
  };
  profile: {
    id: string;
    userId: string;
    fullName: string;
    dob: string;
    nationality: string;
    countryOfResidence: string;
    residentAddress: string;
    emiratesIdNumber: string;
    emiratesIdExpiry: string;
    emiratesIdFrontUrl: string;
    emiratesIdBackUrl: string;
    passportNumber: string | null;
    passportExpiry: string | null;
    passportFrontUrl: string | null;
    tradeLicenseExpiry: string | null;
    tradeLicenseUrl: string | null;
    companyName: string | null;
    companyWebsite: string | null;
    companyDescription: string | null;
    companyAddress: string | null;
    kycStatus: string;
  };
}

interface AuditEntry {
  id: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Conversation {
  id: string;
  type: "admin" | "dm";
  otherName: string;
  otherEmail: string;
  otherRole: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  content: string;
  createdAt: string;
  readAt: string | null;
}

interface LinkedUser {
  linkId: string;
  userId: string;
  role: string;
  status: string;
  linkedAt: string;
  updatedAt: string;
  fullName: string;
  email: string;
  phone: string;
  guestId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Badge helpers now imported from role-utils (kycBadgeProps, statusBadgeProps)

function linkStatusBadge(status: string) {
  switch (status) {
    case "accepted": return { label: "Accepted", className: "bg-green-100 text-green-700 hover:bg-green-100" };
    case "pending": return { label: "Pending", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" };
    case "rejected": return { label: "Rejected", className: "bg-red-100 text-red-700 hover:bg-red-100" };
    default: return { label: status, className: "" };
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case "LOGIN":
    case "GUEST_LOGIN":
      return LogIn;
    case "ACCOUNT_CREATED":
    case "SIGNUP":
    case "GUEST_SIGNUP":
      return UserPlus;
    case "PROFILE_UPDATED":
    case "PROFILE_UPDATE":
    case "GUEST_PROFILE_UPDATE":
      return Settings;
    case "PASSWORD_CHANGED":
    case "PASSWORD_CHANGE":
      return Key;
    case "KYC_VERIFIED":
    case "KYC_REJECTED":
    case "KYC_SUBMITTED":
    case "KYC_STATUS_CHANGE":
      return Shield;
    case "STATUS_CHANGED":
    case "ACCOUNT_STATUS_CHANGE":
      return UserCheck;
    case "MESSAGE_SENT":
      return MessageSquare;
    default:
      return Activity;
  }
}

function getActionLabel(action: string): string {
  switch (action) {
    case "LOGIN":
    case "GUEST_LOGIN":
      return "Signed in";
    case "ACCOUNT_CREATED":
    case "SIGNUP":
    case "GUEST_SIGNUP":
      return "Account created";
    case "PROFILE_UPDATED":
    case "PROFILE_UPDATE":
    case "GUEST_PROFILE_UPDATE":
      return "Profile updated";
    case "PASSWORD_CHANGED":
    case "PASSWORD_CHANGE":
      return "Password changed";
    case "KYC_VERIFIED":
      return "KYC verified";
    case "KYC_REJECTED":
      return "KYC rejected";
    case "KYC_SUBMITTED":
      return "KYC reset to pending";
    case "KYC_STATUS_CHANGE":
      return "KYC status updated";
    case "STATUS_CHANGED":
    case "ACCOUNT_STATUS_CHANGE":
      return "Account status changed";
    case "MESSAGE_SENT":
      return "Message sent";
    case "LOGOUT":
      return "Signed out";
    default:
      return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

// ─── Linked User Card ────────────────────────────────────────────────────────

function LinkedUserCard({ lu, onClick }: { lu: LinkedUser; onClick: () => void }) {
  const sb = linkStatusBadge(lu.status);
  return (
    <div
      className="flex items-center gap-4 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {lu.fullName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{lu.fullName || "—"}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lu.email}</span>
          {lu.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lu.phone}</span>}
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Invited {formatDate(lu.linkedAt)}</span>
          {lu.status !== "pending" && lu.updatedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {lu.status === "accepted" ? "Accepted" : "Rejected"} {formatDate(lu.updatedAt)}
            </span>
          )}
        </div>
      </div>
      <Badge variant="secondary" className={sb.className}>{sb.label}</Badge>
      <Badge variant="secondary">{ROLE_LABELS[lu.role] || lu.role}</Badge>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

// ─── Properties Sub-Tab for PM / PO ─────────────────────────────────────────

const statusColors: Record<string, string> = {
  draft: "border-yellow-500 text-yellow-700 bg-yellow-50",
  active: "bg-green-600 text-white",
  inactive: "bg-gray-200 text-gray-600",
};

function AdminPropertiesTab({ guestId, userRole, userName }: { guestId: string; userRole: string; userName: string }) {
  const [, navigateToProperty] = useLocation();
  const { data: properties = [], isLoading } = useQuery<any[]>({
    queryKey: ["/admin/users", guestId, "st-properties"],
    queryFn: () => api.get(`/admin/users/${guestId}/st-properties`),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Short-Term Properties
        </CardTitle>
        <CardDescription>
          {userRole === "PROPERTY_MANAGER"
            ? `Properties managed by ${userName}`
            : `Properties owned by ${userName}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {properties.length === 0 ? (
          <div className="text-center py-8">
            <Home className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No properties found for this user.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {properties.map((p: any) => {
              const badge = statusColors[p.status] || statusColors.draft;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigateToProperty(`/admin/st-properties/${p.id}`)}
                >
                  {/* Thumbnail */}
                  <div className="h-16 w-24 rounded-md bg-muted overflow-hidden shrink-0">
                    {p.coverPhotoUrl ? (
                      <img
                        src={p.coverPhotoUrl}
                        alt={p.publicName || "Property"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">
                        {p.publicName || "Untitled Property"}
                      </h4>
                      <Badge className={`text-xs ${badge}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {p.propertyType && (
                        <span className="capitalize">{p.propertyType.replace(/_/g, " ")}</span>
                      )}
                      {(p.area || p.city) && (
                        <span>{[p.area, p.city].filter(Boolean).join(", ")}</span>
                      )}
                      {p.bedrooms != null && (
                        <span>{p.bedrooms} bed{p.bedrooms !== 1 ? "s" : ""}</span>
                      )}
                      {p.bathrooms != null && (
                        <span>{p.bathrooms} bath{p.bathrooms !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>

                  {/* Rate */}
                  <div className="text-right shrink-0">
                    {p.nightlyRate ? (
                      <p className="text-sm font-medium">AED {p.nightlyRate}<span className="text-xs text-muted-foreground">/night</span></p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No rate set</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.photosCount} photo{p.photosCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Guest Bookings Tab ─────────────────────────────────────────────────────

const BOOKING_STATUS_CLASSES: Record<string, string> = {
  confirmed: "border-green-500 text-green-700 bg-green-50",
  pending: "border-yellow-500 text-yellow-700 bg-yellow-50",
  cancelled: "border-red-500 text-red-700 bg-red-50",
  completed: "border-blue-500 text-blue-700 bg-blue-50",
};

function BookingDetailSheet({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { data: b, isLoading } = useQuery<any>({
    queryKey: [`/admin/bookings/${bookingId}`],
    queryFn: () => api.get(`/admin/bookings/${bookingId}`),
    enabled: !!bookingId,
  });

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const money = (v: any) => v != null ? `AED ${Number(v).toLocaleString()}` : "—";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-background shadow-xl flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-lg">Booking Detail</h2>
            {b && <p className="text-xs text-muted-foreground font-mono">#{b.id?.slice(0, 8).toUpperCase()}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {b && (
          <div className="p-6 space-y-6">
            {/* Status + source */}
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={BOOKING_STATUS_CLASSES[b.status] || ""}>
                {b.status}
              </Badge>
              {b.source && (
                <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded">{b.source}</span>
              )}
            </div>

            {/* Property */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property</p>
              <p className="font-medium">{b.propertyName || "—"}</p>
              <p className="text-sm text-muted-foreground">{b.propertyCity || ""} {b.propertyType ? `· ${b.propertyType}` : ""}</p>
            </div>

            <Separator />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check-in</p>
                <p className="font-medium">{fmt(b.check_in_date ?? b.checkInDate)}</p>
                {b.check_in_time && <p className="text-sm text-muted-foreground">{b.check_in_time}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check-out</p>
                <p className="font-medium">{fmt(b.check_out_date ?? b.checkOutDate)}</p>
                {b.check_out_time && <p className="text-sm text-muted-foreground">{b.check_out_time}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nights</p>
                <p className="font-medium">{b.total_nights ?? b.totalNights ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Guests</p>
                <p className="font-medium">{b.number_of_guests ?? b.numberOfGuests ?? "—"}</p>
              </div>
            </div>

            <Separator />

            {/* Financials */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financials</p>
              <div className="rounded-lg border divide-y text-sm">
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-medium">{money(b.total_amount ?? b.totalAmount)}</span>
                </div>
                {(b.security_deposit_amount ?? b.securityDepositAmount) != null && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">Security Deposit</span>
                    <span>{money(b.security_deposit_amount ?? b.securityDepositAmount)}</span>
                  </div>
                )}
                {(b.commission_amount ?? b.commissionAmount) != null && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">Commission</span>
                    <span>{money(b.commission_amount ?? b.commissionAmount)}</span>
                  </div>
                )}
                {(b.owner_payout_amount ?? b.ownerPayoutAmount) != null && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">Owner Payout</span>
                    <span>{money(b.owner_payout_amount ?? b.ownerPayoutAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className="capitalize">{b.payment_method ?? b.paymentMethod ?? "—"}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-muted-foreground">Payment Status</span>
                  <span className="capitalize">{b.payment_status ?? b.paymentStatus ?? "—"}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* People */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">People</p>
              <div className="rounded-lg border divide-y text-sm">
                <div className="px-3 py-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Guest</p>
                  <p className="font-medium">{b.guestName || b.guest_name || "—"}</p>
                  {b.guestEmail && <p className="text-muted-foreground text-xs">{b.guestEmail}</p>}
                  {b.guestPhone && <p className="text-muted-foreground text-xs">{b.guestPhone}</p>}
                </div>
                {b.pmName && (
                  <div className="px-3 py-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Property Manager</p>
                    <p className="font-medium">{b.pmName}</p>
                    {b.pmEmail && <p className="text-muted-foreground text-xs">{b.pmEmail}</p>}
                  </div>
                )}
                {b.ownerName && (
                  <div className="px-3 py-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Owner</p>
                    <p className="font-medium">{b.ownerName}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Special requests */}
            {(b.special_requests ?? b.specialRequests) && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Special Requests</p>
                  <p className="text-sm">{b.special_requests ?? b.specialRequests}</p>
                </div>
              </>
            )}

            {/* Notes */}
            {(b.internal_notes ?? b.internalNotes) && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal Notes</p>
                  <p className="text-sm">{b.internal_notes ?? b.internalNotes}</p>
                </div>
              </>
            )}

            <div className="text-xs text-muted-foreground">
              Created {fmt(b.created_at ?? b.createdAt)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GuestBookingsTab({ guestId }: { guestId: string }) {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const { data: bookings = [], isLoading } = useQuery<any[]>({
    queryKey: [`/admin/bookings`, { guestId }],
    queryFn: () => api.get(`/admin/bookings?guestId=${guestId}`),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!bookings.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
          <Calendar className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No bookings found for this guest.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {selectedBookingId && (
        <BookingDetailSheet
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Property</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Check-in</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Check-out</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nights</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Guests</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Source</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b: any) => (
                  <tr
                    key={b.id}
                    className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                    onClick={() => setSelectedBookingId(b.id)}
                  >
                    <td className="px-4 py-2 font-medium">{b.propertyName || "—"}</td>
                    <td className="px-4 py-2">{b.checkInDate ? new Date(b.checkInDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2">{b.checkOutDate ? new Date(b.checkOutDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2">{b.totalNights ?? "—"}</td>
                    <td className="px-4 py-2">{b.numberOfGuests ?? "—"}</td>
                    <td className="px-4 py-2">{b.totalAmount ? `AED ${Number(b.totalAmount).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={BOOKING_STATUS_CLASSES[b.status] || ""}>
                        {b.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground capitalize">{b.source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Guest Reviews Tab ──────────────────────────────────────────────────────

function GuestReviewsTab({ guestId }: { guestId: string }) {
  const { data: reviews = [], isLoading } = useQuery<any[]>({
    queryKey: [`/admin/reviews`, { guestId }],
    queryFn: () => api.get(`/admin/reviews?guestId=${guestId}`),
  });

  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!reviews.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
          <span className="text-3xl text-muted-foreground/30">★</span>
          <p className="text-muted-foreground text-sm">This guest hasn't left any reviews yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reviews ({reviews.length})</CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {reviews.map((r: any) => (
          <div key={r.id} className="px-6 py-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-amber-500 text-sm tracking-wider">{stars(r.rating)}</span>
              <span className="text-xs text-muted-foreground">
                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}
              </span>
            </div>
            <p className="font-medium text-sm">{r.propertyName}</p>
            {r.title && <p className="text-sm font-medium text-foreground">{r.title}</p>}
            {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
            {r.pmResponse && (
              <div className="mt-2 pl-3 border-l-2 border-muted text-sm text-muted-foreground italic">
                <span className="font-medium not-italic text-foreground">PM response: </span>
                {r.pmResponse}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Documents Tab ──────────────────────────────────────────────────────────

function DocumentsTab({ p, userRole }: { p: any; userRole: string }) {
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  const docs = [
    { label: "Emirates ID Front", url: p?.emiratesIdFrontUrl, expiry: p?.emiratesIdExpiry },
    { label: "Emirates ID Back",  url: p?.emiratesIdBackUrl,  expiry: p?.emiratesIdExpiry },
    { label: "Passport",          url: p?.passportFrontUrl,   expiry: p?.passportExpiry },
    ...(userRole === "PROPERTY_MANAGER"
      ? [{ label: "Trade License", url: p?.tradeLicenseUrl, expiry: p?.tradeLicenseExpiry }]
      : []),
  ];

  const isImage = (url: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(url);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
          <CardDescription>Click a document to preview it</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left font-medium px-4 py-3">Document</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Expiry Date</th>
                  <th className="text-left font-medium px-4 py-3">Days Until Expiry</th>
                  <th className="text-left font-medium px-4 py-3">View</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const daysUntil = doc.expiry
                    ? Math.ceil((new Date(doc.expiry).getTime() - Date.now()) / 86400000)
                    : null;
                  const dayColor =
                    daysUntil === null ? "" :
                    daysUntil <= 0 ? "text-red-600" :
                    daysUntil <= 30 ? "text-orange-600" :
                    daysUntil <= 90 ? "text-yellow-600" : "text-green-600";
                  return (
                    <tr key={doc.label} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{doc.label}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={doc.url ? "default" : "secondary"}
                          className={doc.url
                            ? "bg-green-100 text-green-700 hover:bg-green-100"
                            : "bg-red-100 text-red-700 hover:bg-red-100"}
                        >
                          {doc.url ? "Uploaded" : "Missing"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {doc.expiry ? formatDate(doc.expiry) : "—"}
                      </td>
                      <td className={`px-4 py-3 font-medium ${dayColor}`}>
                        {daysUntil === null ? "—" : daysUntil <= 0
                          ? `Expired (${Math.abs(daysUntil)} days ago)`
                          : `${daysUntil} days`}
                      </td>
                      <td className="px-4 py-3">
                        {doc.url ? (
                          <div className="flex items-center gap-2">
                            {isImage(doc.url) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setPreview({ url: doc.url!, label: doc.label })}
                              >
                                <ZoomIn className="h-3.5 w-3.5 mr-1" />
                                Preview
                              </Button>
                            )}
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Image preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-medium text-sm">{preview.label}</span>
              <div className="flex items-center gap-2">
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in new tab
                </a>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPreview(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 flex justify-center bg-muted/30">
              <img
                src={preview.url}
                alt={preview.label}
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminGuestDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);
  const [selectedLinkedGuestId, setSelectedLinkedGuestId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch guest detail
  const { data, isLoading: guestLoading } = useQuery<GuestDetailResponse>({
    queryKey: ["/admin/users", id],
    queryFn: () => api.get(`/admin/users/${id}`),
  });

  // Fetch activity
  const { data: activityData, isLoading: activityLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/admin/users", id, "activity"],
    queryFn: () => api.get(`/admin/users/${id}/activity`),
  });

  // Fetch linked users (uses userId, not guestId)
  const { data: linkedUsers = [], isLoading: linkedLoading } = useQuery<LinkedUser[]>({
    queryKey: ["/links/user", data?.user?.id],
    queryFn: () => api.get(`/links/user/${data!.user.id}`),
    enabled: !!data?.user?.id,
  });

  // Fetch conversations for this user (SA messages tab)
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/admin/users", id, "conversations"],
    queryFn: () => api.get(`/admin/users/${id}/conversations`),
  });

  // Fetch messages for selected conversation
  const { data: convoMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/admin/convo-messages", selectedConvo?.id, selectedConvo?.type],
    queryFn: () =>
      selectedConvo?.type === "dm"
        ? api.get(`/chat/dm/${selectedConvo.id}/messages`)
        : api.get(`/chat/${selectedConvo!.id}/messages`),
    enabled: !!selectedConvo,
    refetchInterval: 5000,
  });

  // Subscription data (PM only)
  const { data: subData } = useQuery<any>({
    queryKey: ["/admin/users", id, "subscription"],
    queryFn: () => api.get(`/admin/users/${id}/subscription`),
    enabled: data?.user?.role === "PROPERTY_MANAGER",
  });

  const { data: availablePlans = [] } = useQuery<any[]>({
    queryKey: ["/subscriptions/plans"],
    queryFn: () => api.get("/subscriptions/plans"),
    enabled: showChangePlan,
  });

  const changePlanMutation = useMutation({
    mutationFn: (planId: string) => api.patch(`/admin/users/${id}/subscription`, { planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/users", id, "subscription"] });
      setShowChangePlan(false);
      toast({ title: "Subscription updated" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Failed to update", variant: "destructive" });
    },
  });

  const cancelSubMutation = useMutation({
    mutationFn: () => api.post(`/admin/users/${id}/subscription/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/users", id, "subscription"] });
      toast({ title: "Subscription cancelled" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Failed to cancel", variant: "destructive" });
    },
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: (profileData: Record<string, string>) =>
      api.patch(`/admin/users/${id}/profile`, profileData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/users", id] });
      queryClient.invalidateQueries({ queryKey: ["/admin/users", id, "activity"] });
      setIsEditing(false);
      toast({ title: "Guest profile updated" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update profile", variant: "destructive" });
    },
  });

  // KYC status mutation
  const updateKyc = useMutation({
    mutationFn: (kycStatus: string) =>
      api.patch(`/admin/users/${id}/kyc`, { kycStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/users", id] });
      queryClient.invalidateQueries({ queryKey: ["/admin/users", id, "activity"] });
      toast({ title: "KYC status updated" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update KYC status", variant: "destructive" });
    },
  });

  // Account status mutation
  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/users", id] });
      queryClient.invalidateQueries({ queryKey: ["/admin/users", id, "activity"] });
      toast({ title: "Account status updated" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  const handleDocUpload = async (side: "front" | "back", file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Only PNG, JPG and JPEG files are allowed", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File must be under 5 MB", variant: "destructive" });
      return;
    }
    if (side === "front") setUploadingFront(true);
    else setUploadingBack(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      const key = side === "front" ? "emiratesIdFrontUrl" : "emiratesIdBackUrl";
      setEditForm((prev) => ({ ...prev, [key]: json.url }));
      toast({ title: `ID ${side === "front" ? "Front" : "Back"} replaced` });
    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
    } finally {
      if (side === "front") setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const startEdit = () => {
    if (!data) return;
    const p = data.profile;
    const u = data.user;
    setEditForm({
      fullName: p?.fullName || "",
      phone: u.phone || "",
      dob: p?.dob || "",
      nationality: p?.nationality || "",
      countryOfResidence: p?.countryOfResidence || "",
      residentAddress: p?.residentAddress || "",
      emiratesIdNumber: p?.emiratesIdNumber || "",
      emiratesIdExpiry: p?.emiratesIdExpiry || "",
      emiratesIdFrontUrl: p?.emiratesIdFrontUrl || "",
      emiratesIdBackUrl: p?.emiratesIdBackUrl || "",
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const saveProfile = () => {
    if (!editForm.fullName?.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    updateProfile.mutate(editForm);
  };

  if (guestLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">User not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </div>
    );
  }

  const user = data.user;
  const p = data.profile;

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground"
          onClick={() => navigate("/admin/users")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{p?.fullName || user.email}</h1>
            <Badge variant="secondary">{ROLE_LABELS[user.role] || user.role}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/messages/chat?user=${id}`)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Message User
            </Button>
            <Badge variant={kycBadgeProps(p?.kycStatus || "pending").variant} className={kycBadgeProps(p?.kycStatus || "pending").className}>
              KYC: {kycBadgeProps(p?.kycStatus || "pending").label}
            </Badge>
            <Badge variant={statusBadgeProps(user.status).variant} className={statusBadgeProps(user.status).className}>
              {statusBadgeProps(user.status).label}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {user.role !== "GUEST" && <TabsTrigger value="linked">Linked Users</TabsTrigger>}
          <TabsTrigger value="messages">Messages</TabsTrigger>
          {user.role === "GUEST" && <TabsTrigger value="bookings">Bookings</TabsTrigger>}
          {user.role === "GUEST" && <TabsTrigger value="reviews">Reviews</TabsTrigger>}
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {user.role === "PROPERTY_MANAGER" && <TabsTrigger value="subscription">Subscription</TabsTrigger>}
          {(user.role === "PROPERTY_MANAGER" || user.role === "PROPERTY_OWNER") && <TabsTrigger value="properties">Properties</TabsTrigger>}
          {user.role === "PROPERTY_MANAGER" && <TabsTrigger value="reports">Reports</TabsTrigger>}
          {user.role === "PROPERTY_MANAGER" && <TabsTrigger value="settlements">Settlements</TabsTrigger>}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ─── Profile Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Personal Information</CardTitle>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveProfile}
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Full Name */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Full Name
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editForm.fullName || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    />
                  ) : (
                    <p className="font-medium">{p?.fullName || "—"}</p>
                  )}
                </div>

                {/* Email (read-only) */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </Label>
                  <p className="font-medium">{user.email}</p>
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </Label>
                  {isEditing ? (
                    <PhoneInput
                      value={editForm.phone || ""}
                      onChange={(v) => setEditForm((prev) => ({ ...prev, phone: v }))}
                    />
                  ) : (
                    <p className="font-medium">{user.phone || "—"}</p>
                  )}
                </div>

                {/* Date of Birth */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Date of Birth
                  </Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editForm.dob || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, dob: e.target.value }))}
                    />
                  ) : (
                    <p className="font-medium">{formatDate(p?.dob)}</p>
                  )}
                </div>

                {/* Nationality */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    Nationality
                  </Label>
                  {isEditing ? (
                    <Select
                      value={editForm.nationality || ""}
                      onValueChange={(v) => setEditForm((prev) => ({ ...prev, nationality: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{p?.nationality || "—"}</p>
                  )}
                </div>

                {/* Country of Residence */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Country of Residence
                  </Label>
                  {isEditing ? (
                    <Select
                      value={editForm.countryOfResidence || ""}
                      onValueChange={(v) => setEditForm((prev) => ({ ...prev, countryOfResidence: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{p?.countryOfResidence || "—"}</p>
                  )}
                </div>

                {/* Resident Address */}
                <div className="space-y-1 md:col-span-2 lg:col-span-3">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Resident Address
                  </Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.residentAddress || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, residentAddress: e.target.value }))}
                      rows={2}
                    />
                  ) : (
                    <p className="font-medium">{p?.residentAddress || "—"}</p>
                  )}
                </div>

                {/* Member Since */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Member Since
                  </Label>
                  <p className="font-medium">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Information (PM only) */}
          {user.role === "PROPERTY_MANAGER" && (
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      Company Name
                    </Label>
                    <p className="font-medium">{p?.companyName || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      Company Website
                    </Label>
                    <p className="font-medium">{p?.companyWebsite || "—"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Company Description
                    </Label>
                    <p className="font-medium">{p?.companyDescription || "—"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      Company Address
                    </Label>
                    <p className="font-medium">{p?.companyAddress || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ID Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Identity Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Emirates ID Number */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5" />
                    Emirates ID Number
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editForm.emiratesIdNumber || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, emiratesIdNumber: e.target.value }))}
                      placeholder="784-XXXX-XXXXXXX-X"
                    />
                  ) : (
                    <p className="font-medium">{p?.emiratesIdNumber || "—"}</p>
                  )}
                </div>

                {/* Emirates ID Expiry */}
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Emirates ID Expiry
                  </Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editForm.emiratesIdExpiry || ""}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, emiratesIdExpiry: e.target.value }))}
                    />
                  ) : (
                    <p className="font-medium">{formatDate(p?.emiratesIdExpiry)}</p>
                  )}
                </div>
              </div>

              {/* ID Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(["front", "back"] as const).map((side) => {
                  const urlKey = side === "front" ? "emiratesIdFrontUrl" : "emiratesIdBackUrl";
                  const currentUrl = isEditing ? editForm[urlKey] : (side === "front" ? p?.emiratesIdFrontUrl : p?.emiratesIdBackUrl);
                  const uploading = side === "front" ? uploadingFront : uploadingBack;
                  return (
                    <div key={side} className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" />
                        ID {side === "front" ? "Front" : "Back"}
                      </Label>
                      <div className="relative border rounded-lg overflow-hidden bg-muted/30">
                        {currentUrl ? (
                          <img
                            src={currentUrl}
                            alt={`Emirates ID ${side === "front" ? "Front" : "Back"}`}
                            className="w-full h-40 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => { setLightboxSrc(currentUrl); setLightboxAlt(`Emirates ID ${side === "front" ? "Front" : "Back"}`); }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                            No image uploaded
                          </div>
                        )}

                        {/* Upload overlay in edit mode */}
                        {isEditing && (
                          <label className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
                            {uploading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            ) : (
                              <>
                                <UploadCloud className="h-6 w-6 text-white" />
                                <span className="text-xs text-white font-medium">Click to replace</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg"
                              className="sr-only"
                              disabled={uploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleDocUpload(side, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                      {isEditing && (
                        <p className="text-xs text-muted-foreground">Hover over image and click to replace · PNG/JPG, max 5 MB</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Passport Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Passport</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Passport Number
                  </Label>
                  <p className="font-medium">{p?.passportNumber || "—"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Passport Expiry
                  </Label>
                  <p className="font-medium">{formatDate(p?.passportExpiry)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Passport Copy
                </Label>
                <div className="relative border rounded-lg overflow-hidden bg-muted/30 w-fit">
                  {p?.passportFrontUrl ? (
                    <img
                      src={p.passportFrontUrl}
                      alt="Passport"
                      className="h-40 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => { setLightboxSrc(p.passportFrontUrl); setLightboxAlt("Passport"); }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="h-40 w-64 flex items-center justify-center text-sm text-muted-foreground">
                      No image uploaded
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trade License (PM only) */}
          {user.role === "PROPERTY_MANAGER" && (
            <Card>
              <CardHeader>
                <CardTitle>Trade License</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      Trade License Expiry
                    </Label>
                    <p className="font-medium">{formatDate(p?.tradeLicenseExpiry)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Trade License Copy
                  </Label>
                  <div className="relative border rounded-lg overflow-hidden bg-muted/30 w-fit">
                    {p?.tradeLicenseUrl ? (
                      <img
                        src={p.tradeLicenseUrl}
                        alt="Trade License"
                        className="h-40 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => { setLightboxSrc(p.tradeLicenseUrl!); setLightboxAlt("Trade License"); }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="h-40 w-64 flex items-center justify-center text-sm text-muted-foreground">
                        No image uploaded
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* KYC Status Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                KYC Verification
              </CardTitle>
              <CardDescription>
                Current status:{" "}
                <Badge variant={kycBadgeProps(p?.kycStatus || "pending").variant} className={`ml-1 ${kycBadgeProps(p?.kycStatus || "pending").className}`}>
                  {kycBadgeProps(p?.kycStatus || "pending").label}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {p?.kycStatus !== "verified" && (
                  <Button
                    onClick={() => updateKyc.mutate("verified")}
                    disabled={updateKyc.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {updateKyc.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Verify KYC
                  </Button>
                )}
                {p?.kycStatus !== "rejected" && (
                  <Button
                    variant="destructive"
                    onClick={() => updateKyc.mutate("rejected")}
                    disabled={updateKyc.isPending}
                  >
                    {updateKyc.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Reject KYC
                  </Button>
                )}
                {p?.kycStatus !== "pending" && (
                  <Button
                    variant="outline"
                    onClick={() => updateKyc.mutate("pending")}
                    disabled={updateKyc.isPending}
                  >
                    {updateKyc.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Reset to Pending
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Status Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Account Status
              </CardTitle>
              <CardDescription>
                Current status:{" "}
                <Badge variant={statusBadgeProps(user.status).variant} className={`ml-1 ${statusBadgeProps(user.status).className}`}>
                  {statusBadgeProps(user.status).label}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                {user.status !== "active" && (
                  <Button
                    onClick={() => updateStatus.mutate("active")}
                    disabled={updateStatus.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {updateStatus.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserCheck className="h-4 w-4 mr-2" />
                    )}
                    Activate Account
                  </Button>
                )}
                {user.status !== "suspended" && (
                  <Button
                    variant="destructive"
                    onClick={() => updateStatus.mutate("suspended")}
                    disabled={updateStatus.isPending}
                  >
                    {updateStatus.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Ban className="h-4 w-4 mr-2" />
                    )}
                    Suspend Account
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Linked Users Tab ────────────────────────────────────────────── */}
        {user.role !== "GUEST" && <TabsContent value="linked">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Linked Users
              </CardTitle>
              <CardDescription>
                {user.role === "PROPERTY_MANAGER"
                  ? "Property Owners and Tenants linked to this Property Manager"
                  : "Property Managers linked to this user"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linkedLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : linkedUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No linked users</p>
                </div>
              ) : (
                <>
                  {user.role === "PROPERTY_MANAGER" && (() => {
                    const owners = linkedUsers.filter((u) => u.role === "PROPERTY_OWNER");
                    const tenants = linkedUsers.filter((u) => u.role === "TENANT");
                    return (
                      <div className="space-y-6">
                        {owners.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-3">
                              Property Owners ({owners.length})
                            </h3>
                            <div className="grid gap-3">
                              {owners.map((lu) => (
                                <LinkedUserCard key={lu.linkId} lu={lu} onClick={() => setSelectedLinkedGuestId(lu.guestId)} />
                              ))}
                            </div>
                          </div>
                        )}
                        {tenants.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-3">
                              Tenants ({tenants.length})
                            </h3>
                            <div className="grid gap-3">
                              {tenants.map((lu) => (
                                <LinkedUserCard key={lu.linkId} lu={lu} onClick={() => setSelectedLinkedGuestId(lu.guestId)} />
                              ))}
                            </div>
                          </div>
                        )}
                        {owners.length === 0 && tenants.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No linked users</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {(user.role === "PROPERTY_OWNER" || user.role === "TENANT") && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Property Managers ({linkedUsers.length})
                      </h3>
                      <div className="grid gap-3">
                        {linkedUsers.map((lu) => (
                          <LinkedUserCard key={lu.linkId} lu={lu} onClick={() => setSelectedLinkedGuestId(lu.guestId)} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>}

        {/* ─── Bookings Tab (Guest only) ─────────────────────────────────────── */}
        {user.role === "GUEST" && (
          <TabsContent value="bookings">
            <GuestBookingsTab guestId={user.id} />
          </TabsContent>
        )}

        {user.role === "GUEST" && (
          <TabsContent value="reviews">
            <GuestReviewsTab guestId={user.id} />
          </TabsContent>
        )}

        {/* ─── Documents Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="documents">
          <DocumentsTab p={p} userRole={user.role} />
        </TabsContent>

        {/* ─── Messages Tab (SA read-only) ───────────────────────────────────── */}
        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages
              </CardTitle>
              <CardDescription>Read-only view of all conversations for this user</CardDescription>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No conversations found</p>
                </div>
              ) : (
                <div className="flex border rounded-lg overflow-hidden" style={{ height: "500px" }}>
                  {/* Conversation list */}
                  <div className="w-72 border-r flex flex-col shrink-0">
                    <div className="px-3 py-2 border-b bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground">{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
                    </div>
                    <ScrollArea className="flex-1">
                      {conversations.map((c) => (
                        <div
                          key={c.id}
                          className={cn(
                            "px-3 py-3 border-b cursor-pointer transition-colors",
                            selectedConvo?.id === c.id ? "bg-accent" : "hover:bg-accent/50"
                          )}
                          onClick={() => setSelectedConvo(c)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {c.type === "admin" ? "Admin" : "DM"}
                            </Badge>
                            <span className="text-sm font-medium truncate">{c.otherName}</span>
                          </div>
                          {c.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {c.messageCount} message{c.messageCount !== 1 ? "s" : ""}
                            </span>
                            {c.lastMessageAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(c.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>

                  {/* Message viewer */}
                  <div className="flex-1 flex flex-col">
                    {!selectedConvo ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <p className="text-sm">Select a conversation to view messages</p>
                      </div>
                    ) : (
                      <>
                        <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{selectedConvo.otherName}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedConvo.type === "admin" ? "Admin Support" : `DM · ${ROLE_LABELS[selectedConvo.otherRole] || selectedConvo.otherRole}`}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">Read-only</Badge>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                          <div className="space-y-3">
                            {convoMessages.map((msg) => {
                              const isFromUser = msg.senderId === user.id;
                              return (
                                <div
                                  key={msg.id}
                                  className={cn("flex gap-2", isFromUser ? "flex-row" : "flex-row-reverse")}
                                >
                                  <Avatar className="h-7 w-7 shrink-0 mt-1">
                                    <AvatarFallback className={cn("text-xs", isFromUser ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                      {isFromUser
                                        ? (p?.fullName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?")
                                        : selectedConvo.type === "admin" ? "SA" : (selectedConvo.otherName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className={cn("max-w-[70%] flex flex-col gap-1", isFromUser ? "items-start" : "items-end")}>
                                    <div
                                      className={cn(
                                        "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                                        isFromUser
                                          ? "bg-primary text-primary-foreground rounded-tl-sm"
                                          : "bg-muted rounded-tr-sm"
                                      )}
                                    >
                                      {msg.content}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground px-1">
                                      {isFromUser ? (p?.fullName || user.email) : selectedConvo.otherName}
                                      {" · "}
                                      {new Date(msg.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Subscription Tab (PM only) ────────────────────────────────────── */}
        {user.role === "PROPERTY_MANAGER" && (
          <TabsContent value="subscription" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription
                </CardTitle>
                <CardDescription>Current plan and billing information</CardDescription>
              </CardHeader>
              <CardContent>
                {subData?.subscription ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Plan</Label>
                        <p className="font-medium text-lg">{subData.subscription.planName}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Price</Label>
                        <p className="font-medium">AED {subData.subscription.planPrice} / {subData.subscription.planBillingCycle}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Status</Label>
                        <div>
                          <Badge variant={
                            subData.subscription.status === "active" ? "default" :
                            subData.subscription.status === "cancelled" ? "destructive" :
                            subData.subscription.status === "pending_payment" ? "destructive" :
                            "secondary"
                          }>
                            {subData.subscription.status === "pending_payment" ? "Awaiting Payment" :
                             subData.subscription.status.charAt(0).toUpperCase() + subData.subscription.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      {subData.subscription.trial_ends_at && (
                        <div className="space-y-1">
                          <Label className="text-muted-foreground text-xs">Trial Ends</Label>
                          <p className="font-medium">{new Date(subData.subscription.trial_ends_at).toLocaleDateString()}</p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Period</Label>
                        <p className="font-medium">
                          {new Date(subData.subscription.current_period_start).toLocaleDateString()} — {new Date(subData.subscription.current_period_end).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {(subData.subscription.status === "active" || subData.subscription.status === "trial") && (
                      <div className="flex gap-2 mt-6 pt-4 border-t">
                        <Button variant="outline" size="sm" onClick={() => setShowChangePlan(true)}>
                          Change Plan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={cancelSubMutation.isPending}
                          onClick={() => {
                            if (window.confirm("Cancel this PM's subscription? This cannot be undone.")) {
                              cancelSubMutation.mutate();
                            }
                          }}
                        >
                          {cancelSubMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-muted-foreground">No active subscription</p>
                    <Button variant="outline" size="sm" onClick={() => setShowChangePlan(true)}>
                      Assign Plan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {subData?.invoices?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Invoice History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Date</th>
                          <th className="text-left py-2 font-medium">Plan</th>
                          <th className="text-left py-2 font-medium">Amount</th>
                          <th className="text-left py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subData.invoices.map((inv: any) => (
                          <tr key={inv.id} className="border-b last:border-0">
                            <td className="py-2">{new Date(inv.created_at).toLocaleDateString()}</td>
                            <td className="py-2">{inv.planName}</td>
                            <td className="py-2">AED {inv.amount}</td>
                            <td className="py-2">
                              <Badge variant={inv.invoice_status === "paid" ? "default" : "secondary"}>
                                {(inv.invoice_status || inv.status || '').charAt(0).toUpperCase() + (inv.invoice_status || inv.status || '').slice(1)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {showChangePlan && (
              <Card>
                <CardHeader>
                  <CardTitle>Change Plan</CardTitle>
                  <CardDescription>Select a new plan for this user</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {availablePlans.map((plan: any) => (
                      <div
                        key={plan.id}
                        className={cn(
                          "border rounded-lg p-4 cursor-pointer transition-all hover:border-primary",
                          subData?.subscription?.plan_id === plan.id && "opacity-50"
                        )}
                        onClick={() => {
                          if (subData?.subscription?.plan_id !== plan.id) {
                            changePlanMutation.mutate(plan.id);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{plan.name}</p>
                            {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-bold">AED {plan.price}</p>
                            <p className="text-xs text-muted-foreground">/{plan.billingCycle}</p>
                          </div>
                        </div>
                        {subData?.subscription?.plan_id === plan.id && (
                          <Badge className="mt-2" variant="secondary">Current Plan</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-4" onClick={() => setShowChangePlan(false)}>
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* ─── Properties Tab ─────────────────────────────────────────────── */}
        {(user.role === "PROPERTY_MANAGER" || user.role === "PROPERTY_OWNER") && (
          <TabsContent value="properties">
            <AdminPropertiesTab guestId={id} userRole={user.role} userName={user.fullName || user.email} />
          </TabsContent>
        )}

        {/* ─── Reports Tab (PM only) ────────────────────────────────────────── */}
        {user.role === "PROPERTY_MANAGER" && (
          <TabsContent value="reports">
            <PmReportsTab pmUserId={user.id} />
          </TabsContent>
        )}

        {/* ─── Settlements Tab (PM only) ──────────────────────────────────── */}
        {user.role === "PROPERTY_MANAGER" && (
          <TabsContent value="settlements">
            <PmSettlementsTab pmUserId={user.id} />
          </TabsContent>
        )}

        {/* ─── Activity Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Account activity history for this guest</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !activityData?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No activity recorded yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activityData.map((entry, idx) => {
                    const Icon = getActionIcon(entry.action);
                    return (
                      <div key={entry.id}>
                        <div className="flex items-start gap-4 py-3">
                          <div className="mt-0.5 h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{getActionLabel(entry.action)}</p>
                            {entry.details && (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {entry.details}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDateTime(entry.createdAt)}
                              {entry.ipAddress && ` • ${entry.ipAddress}`}
                            </p>
                          </div>
                        </div>
                        {idx < activityData.length - 1 && <Separator />}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Inline profile dialog for linked users */}
      <AdminLinkedUserDialog
        guestId={selectedLinkedGuestId}
        open={!!selectedLinkedGuestId}
        onClose={() => setSelectedLinkedGuestId(null)}
      />

      {/* Document image lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxSrc(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-medium text-sm">{lightboxAlt}</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setLightboxSrc(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 flex justify-center bg-muted/30">
              <img
                src={lightboxSrc}
                alt={lightboxAlt}
                className="max-h-[70vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PM Reports Tab ──────────────────────────────────────────────────────────

function PmReportsTab({ pmUserId }: { pmUserId: string }) {
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/admin/pm-reports", pmUserId],
    queryFn: () => api.get(`/st-properties/reports/earnings?pmUserId=${pmUserId}`),
    enabled: !!pmUserId,
    retry: 1,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <TrendingUp className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-destructive">Failed to load reports</p>
          <p className="text-sm mt-1">{(error as any)?.message || "Unknown error"}</p>
          <p className="text-xs mt-2 text-muted-foreground">PM ID: {pmUserId}</p>
        </CardContent>
      </Card>
    );
  }

  const fmt = (v: any) => `AED ${parseFloat(v || "0").toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Earnings Report
          </CardTitle>
          <CardDescription>Commission and revenue summary for this PM</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg border p-4 bg-emerald-50/50">
              <p className="text-xs text-muted-foreground mb-1">Total Booking Income</p>
              <p className="text-xl font-bold text-emerald-700">{fmt(data?.totalBookingIncome)}</p>
              <p className="text-xs text-muted-foreground mt-1">{data?.totalBookings || 0} bookings</p>
            </div>
            <div className="rounded-lg border p-4 bg-purple-50/50">
              <p className="text-xs text-muted-foreground mb-1">PM Commission Earned</p>
              <p className="text-xl font-bold text-purple-700">{fmt(data?.totalCommission)}</p>
            </div>
            <div className="rounded-lg border p-4 bg-blue-50/50">
              <p className="text-xs text-muted-foreground mb-1">Owner Payouts</p>
              <p className="text-xl font-bold text-blue-700">{fmt(data?.totalOwnerPayouts)}</p>
            </div>
            <div className="rounded-lg border p-4 bg-orange-50/50">
              <p className="text-xs text-muted-foreground mb-1">Monthly Fixed Fees</p>
              <p className="text-xl font-bold text-orange-700">{fmt(data?.monthlyFixedTotal)}</p>
            </div>
          </div>

          {/* Per-property breakdown */}
          {data?.properties?.length > 0 && (
            <>
              <h4 className="text-sm font-semibold mb-3">Per-Property Breakdown</h4>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-4 py-2 font-medium">Property</th>
                      <th className="px-4 py-2 font-medium">Commission Type</th>
                      <th className="px-4 py-2 font-medium text-center">Bookings</th>
                      <th className="px-4 py-2 font-medium text-right">Total Income</th>
                      <th className="px-4 py-2 font-medium text-right">Commission</th>
                      <th className="px-4 py-2 font-medium text-right">Owner Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.properties.map((p: any) => (
                      <tr key={p.id} className="border-t hover:bg-accent/30">
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{p.publicName || "Untitled"}</p>
                          <p className="text-xs text-muted-foreground">{p.buildingName} {p.unitNumber}</p>
                        </td>
                        <td className="px-4 py-2.5 capitalize text-sm">
                          {p.commissionType === "percentage_per_booking" ? `${p.commissionValue}%` : p.commissionType === "fixed_monthly" ? `AED ${p.commissionValue}/mo` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-center">{p.bookingCount}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(p.totalIncome)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-purple-700">{fmt(p.commission)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(p.ownerPayout)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Recent bookings */}
          {data?.recentBookings?.length > 0 && (
            <>
              <h4 className="text-sm font-semibold mt-6 mb-3">Recent Bookings</h4>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-4 py-2 font-medium">Property</th>
                      <th className="px-4 py-2 font-medium">Guest</th>
                      <th className="px-4 py-2 font-medium">Check-In</th>
                      <th className="px-4 py-2 font-medium text-right">Total</th>
                      <th className="px-4 py-2 font-medium text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentBookings.slice(0, 20).map((b: any) => (
                      <tr key={b.id} className="border-t hover:bg-accent/30">
                        <td className="px-4 py-2 truncate max-w-[160px]">{b.propertyName || "—"}</td>
                        <td className="px-4 py-2">{b.guestName || "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{b.checkIn ? new Date(b.checkIn).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                        <td className="px-4 py-2 text-right">{fmt(b.totalAmount)}</td>
                        <td className="px-4 py-2 text-right font-medium text-purple-700">{fmt(b.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!data?.properties?.length && !data?.recentBookings?.length && (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No earnings data available.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PM Settlements Tab ──────────────────────────────────────────────────────

function PmSettlementsTab({ pmUserId }: { pmUserId: string }) {
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/admin/pm-settlements", pmUserId],
    queryFn: () => api.get(`/st-properties/settlements?pmUserId=${pmUserId}`),
    enabled: !!pmUserId,
    retry: 1,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Receipt className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-destructive">Failed to load settlements</p>
          <p className="text-sm mt-1">{(error as any)?.message || "Unknown error"}</p>
          <p className="text-xs mt-2 text-muted-foreground">PM ID: {pmUserId}</p>
        </CardContent>
      </Card>
    );
  }

  const settlements: any[] = data?.settlements || [];
  const summary = data?.summary;
  const fmt = (v: any) => `AED ${parseFloat(v || "0").toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border p-4 bg-red-50/50">
            <p className="text-xs text-muted-foreground mb-1">Pending Owed</p>
            <p className="text-lg font-bold text-red-700">{fmt(summary.pendingOwed)}</p>
          </div>
          <div className="rounded-lg border p-4 bg-green-50/50">
            <p className="text-xs text-muted-foreground mb-1">Pending Receivable</p>
            <p className="text-lg font-bold text-green-700">{fmt(summary.pendingReceivable)}</p>
          </div>
          <div className="rounded-lg border p-4 bg-blue-50/50">
            <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="text-lg font-bold text-blue-700">{fmt(summary.totalPaid)}</p>
          </div>
          <div className="rounded-lg border p-4 bg-emerald-50/50">
            <p className="text-xs text-muted-foreground mb-1">Total Received</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(summary.totalReceived)}</p>
          </div>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Settlement Ledger
          </CardTitle>
          <CardDescription>All settlement records for this PM</CardDescription>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No settlements recorded yet.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Property</th>
                    <th className="px-4 py-2 font-medium">Reason</th>
                    <th className="px-4 py-2 font-medium">From → To</th>
                    <th className="px-4 py-2 font-medium text-right">Amount</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s: any) => (
                    <tr key={s.id} className="border-t hover:bg-accent/30">
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(s.paidAt || s.createdAt)}</td>
                      <td className="px-4 py-2.5 truncate max-w-[150px]">{s.propertyName || "—"}</td>
                      <td className="px-4 py-2.5 truncate max-w-[150px] text-muted-foreground">{s.reason || s.expenseDescription || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.fromName || "—"} → {s.toName || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmt(s.amount)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColor[s.status] || "bg-gray-100 text-gray-700")}>
                          {s.status || "pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
