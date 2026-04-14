import { useState, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import SharedBookings from "@/pages/portal/my-bookings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  ArrowLeft,
  Pencil,
  Home,
  FileText,
  Camera,
  Sparkles,
  DollarSign,
  ShieldCheck,
  Users,
  ClipboardCheck,
  CalendarDays,
  Receipt,
  Activity,
  MapPin,
  BedDouble,
  Bath,
  Maximize2,
  Eye,
  Building2,
  CreditCard,
  Clock,
  Wifi,
  Droplets,
  Flame,
  Percent,
  Check,
  X,
  ExternalLink,
  TrendingUp,
  Package,
  Star,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Ban,
  LogIn,
  LogOut,
  Banknote,
  Mail,
  Phone,
  Hash,
  Filter,
  MoreHorizontal,
  AlertTriangle,
  UserCheck,
  XCircle,
  RefreshCw,
  Key,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StPropertyData {
  id: string;
  publicName: string | null;
  status: "draft" | "active" | "inactive";
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  areaName: string | null;
  unitNumber: string | null;
  floorNumber: string | null;
  buildingName: string | null;
  areaSqft: number | null;
  viewType: string | null;
  ceilingHeight: number | null;
  hasMaidRoom: boolean;
  isFurnished: boolean;
  isSmartHome: boolean;
  latitude: string | null;
  longitude: string | null;
  parkingSpaces: number | null;
  parkingType: string | null;
  accessType: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  internalNotes: string | null;
  nightlyRate: string | null;
  weekendRate: string | null;
  minimumStay: number | null;
  cleaningFee: string | null;
  securityDepositRequired: boolean;
  securityDepositAmount: string | null;
  acceptedPaymentMethods: any;
  bankAccountBelongsTo: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  iban: string | null;
  swiftCode: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  cancellationPolicy: string | null;
  poUserId: string | null;
  commissionType: string | null;
  commissionValue: string | null;
  acquisitionType: string | null;
  confirmed: boolean;
  agreementConfirmed: boolean;
  photos: any[];
  amenities: string[];
  policies: any[];
  documents: any[];
  acquisitionDetails: any;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

// ─── Tab config ─────────────────────────────────────────────────────────────

const ALL_TABS = [
  { key: "details",      name: "Property Details",  icon: Home,          permission: "properties.view" },
  { key: "description", name: "Description",        icon: FileText,      permission: "properties.view" },
  { key: "photos",      name: "Photos",             icon: Camera,        permission: "properties.view" },
  { key: "amenities",   name: "Amenities",          icon: Sparkles,      permission: "properties.view" },
  { key: "pricing",     name: "Pricing",            icon: DollarSign,    permission: "properties.view" },
  { key: "policies",    name: "Policies",           icon: ShieldCheck,   permission: "properties.view" },
  { key: "owner",       name: "Property Owner",     icon: Users,         permission: "properties.view" },
  { key: "agreement",   name: "Agreement",          icon: ClipboardCheck, permission: "properties.view" },
  { key: "inventory",   name: "Inventory",          icon: Package,       permission: "properties.view" },
  { key: "investment",  name: "Investment",         icon: TrendingUp,    permission: "financials.view" },
  { key: "calendar",    name: "Calendar & Pricing", icon: CalendarDays,  permission: "bookings.view" },
  { key: "bookings",    name: "Bookings",           icon: CalendarDays,  permission: "bookings.view" },
  { key: "transactions",name: "Transactions",       icon: Receipt,       permission: "financials.view" },
  { key: "reviews",     name: "Reviews",            icon: Star,          permission: "bookings.view" },
  { key: "activity",    name: "Activity Log",       icon: Activity,      permission: "properties.view" },
] as const;

type TabKey = (typeof ALL_TABS)[number]["key"];

const statusBadge: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  active: { label: "Active", className: "bg-green-600 text-white" },
  inactive: { label: "Inactive", className: "bg-gray-200 text-gray-600" },
};

// ─── Amenity label lookup ──────────────────────────────────────────────────

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi",
  air_conditioning: "Air Conditioning",
  tv: "TV",
  iron: "Iron",
  hair_dryer: "Hair Dryer",
  swimming_pool: "Swimming Pool",
  gym: "Gym / Fitness Center",
  workspace: "Workspace / Desk",
  elevator: "Elevator",
  free_parking: "Free Parking",
  concierge: "Concierge",
  doorman: "Doorman",
  storage_room: "Storage Room",
  central_gas: "Central Gas",
  "24_7_security": "24/7 Security",
  cctv: "CCTV",
  intercom: "Intercom",
  beach_access: "Beach Access",
  bbq_area: "BBQ Area",
  garden: "Garden",
  kids_play_area: "Kids Play Area",
  kitchen: "Kitchen",
  coffee_machine: "Coffee Machine",
  dishwasher: "Dishwasher",
  microwave: "Microwave",
  oven: "Oven",
  washer: "Washer",
  dryer: "Dryer",
  pets_allowed: "Pets Allowed",
  smoking_area: "Smoking Area",
  housekeeping_available: "Housekeeping Available",
};

const CANCELLATION_LABELS: Record<string, string> = {
  flexible: "Flexible — Full refund up to 24 hours before check-in",
  moderate: "Moderate — Full refund up to 5 days before check-in",
  strict: "Strict — 50% refund up to 7 days before check-in",
  non_refundable: "Non-Refundable — No refund after booking",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(time: string | null) {
  if (!time) return "—";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2">
      <span className="text-sm text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

function parsePaymentMethods(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return [];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function StPropertyView({ id: propId }: { id?: string } = {}) {
  const [match, params] = useRoute("/portal/st-properties/:id");
  const [location, navigate] = useLocation();
  const id = propId || params?.id;

  const initialTab = (() => {
    try {
      const search = window.location.search;
      const tab = new URLSearchParams(search).get("tab");
      const valid = ALL_TABS.map(t => t.key);
      return (tab && valid.includes(tab as TabKey) ? tab : "details") as TabKey;
    } catch { return "details" as TabKey; }
  })();

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("properties.edit");
  const canManageBookings = hasPermission("bookings.manage");
  const canManageFinancials = hasPermission("financials.manage");

  // Filter tabs to only those the user has permission to see
  const TABS = ALL_TABS.filter(tab => hasPermission(tab.permission));

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    navigate(`/portal/st-properties/${id}?tab=${tab}`, { replace: true });
  };

  const { data: property, isLoading, isError } = useQuery<StPropertyData>({
    queryKey: ["/st-properties", id],
    queryFn: () => api.get(`/st-properties/${id}`),
    enabled: !!id,
  });

  if (isLoading || !property) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Property not found or could not be loaded.</p>
        <Button variant="outline" onClick={() => navigate("/portal/st-properties")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Properties
        </Button>
      </div>
    );
  }

  const badge = statusBadge[property.status] || statusBadge.draft;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between h-14 px-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/portal/st-properties")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-lg truncate max-w-[400px]">
            {property.publicName || "Untitled Property"}
          </h1>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => navigate(`/portal/st-properties/${id}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit Property
          </Button>
        )}
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tab sidebar */}
        <aside className="w-60 border-r bg-muted/30 overflow-y-auto shrink-0">
          <nav className="p-3 space-y-1">
            {TABS.map((tab) => {
              const isCurrent = tab.key === activeTab;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left",
                    isCurrent
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <TabIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "details" && <ViewDetails property={property} />}
          {activeTab === "description" && <ViewDescription property={property} />}
          {activeTab === "photos" && <ViewPhotos property={property} />}
          {activeTab === "amenities" && <ViewAmenities property={property} />}
          {activeTab === "pricing" && <ViewPricing property={property} />}
          {activeTab === "policies" && <ViewPolicies property={property} />}
          {activeTab === "owner" && <ViewOwner property={property} />}
          {activeTab === "agreement" && <ViewAgreement property={property} />}

          {activeTab === "inventory" && <ViewInventory property={property} />}
          {activeTab === "investment" && <ViewInvestment property={property} />}
          {activeTab === "calendar" && <ViewCalendarPricing property={property} />}
          {activeTab === "bookings" && <SharedBookings propertyId={property.id} embedded />}
          {activeTab === "transactions" && <ViewTransactions property={property} />}
          {activeTab === "reviews" && <ViewReviews property={property} />}
          {activeTab === "activity" && <ViewActivity property={property} />}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Property Details ──────────────────────────────────────────────────

function ViewDetails({ property }: { property: StPropertyData }) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Basic Information */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Home className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Basic Information</h3>
        </div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Property Type" value={property.propertyType?.replace(/_/g, " ")} />
          <InfoRow label="Unit Number" value={property.unitNumber} />
          <InfoRow label="Floor Number" value={property.floorNumber} />
          <InfoRow label="Building Name" value={property.buildingName} />
          <InfoRow label="Area (SQFT)" value={property.areaSqft} />
          <InfoRow label="View Type" value={property.viewType?.replace(/_/g, " ")} />
          <InfoRow label="Bedrooms" value={property.bedrooms} />
          <InfoRow label="Bathrooms" value={property.bathrooms} />
          <InfoRow label="Max Guests" value={property.maxGuests} />
          <InfoRow label="Ceiling Height (CM)" value={property.ceilingHeight} />
          <InfoRow
            label="Maid Room"
            value={property.maidRoom ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
          />
          <InfoRow
            label="Furnished"
            value={property.furnished ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
          />
          <InfoRow
            label="Smart Home"
            value={property.smartHome ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </section>

      {/* Address */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Address</h3>
        </div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Address Line 1" value={property.addressLine1} />
          <InfoRow label="Address Line 2" value={property.addressLine2} />
          <InfoRow label="City" value={property.city} />
          <InfoRow label="Area" value={property.areaName} />
        </div>
      </section>

      {/* Parking & Access */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Parking & Access</h3>
        </div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Parking Spaces" value={property.parkingSpaces ?? 0} />
          <InfoRow label="Parking Type" value={property.parkingType?.replace(/_/g, " ")} />
          <InfoRow label="Access Type" value={property.accessType?.replace(/_/g, " ")} />
        </div>
      </section>
    </div>
  );
}

// ─── Tab: Description ───────────────────────────────────────────────────────

function ViewDescription({ property }: { property: StPropertyData }) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Listing Name</h3>
        </div>
        <Separator className="mb-4" />
        <p className="text-sm font-medium">{property.publicName || "—"}</p>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Short Description</h3>
        </div>
        <Separator className="mb-4" />
        <p className="text-sm whitespace-pre-wrap">{property.shortDescription || "—"}</p>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Long Description</h3>
        </div>
        <Separator className="mb-4" />
        <p className="text-sm whitespace-pre-wrap">{property.longDescription || "—"}</p>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Internal Notes</h3>
        </div>
        <Separator className="mb-4" />
        <p className="text-sm whitespace-pre-wrap text-muted-foreground italic">
          {property.internalNotes || "No internal notes."}
        </p>
      </section>
    </div>
  );
}

// ─── Tab: Photos ────────────────────────────────────────────────────────────

function ViewPhotos({ property }: { property: StPropertyData }) {
  const photos = property.photos || [];
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Camera className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Photos</h3>
        <span className="text-sm text-muted-foreground">({photos.length})</span>
      </div>
      <Separator className="mb-4" />

      {photos.length === 0 ? (
        <div className="text-center py-12">
          <Camera className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No photos uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo: any, i: number) => (
            <div
              key={photo.id || i}
              className="relative rounded-lg overflow-hidden border bg-muted aspect-[4/3]"
            >
              <img
                src={photo.url || photo.fileUrl}
                alt={photo.caption || `Photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
              {photo.isCover && (
                <Badge className="absolute top-2 left-2 bg-primary text-white text-xs">
                  Cover
                </Badge>
              )}
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                  <p className="text-white text-xs truncate">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Amenities ─────────────────────────────────────────────────────────

function ViewAmenities({ property }: { property: StPropertyData }) {
  const amenities = property.amenities || [];
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Amenities</h3>
        <span className="text-sm text-muted-foreground">({amenities.length})</span>
      </div>
      <Separator className="mb-4" />

      {amenities.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No amenities selected yet.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {amenities.map((key: string) => (
            <div
              key={key}
              className="px-4 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20"
            >
              {AMENITY_LABELS[key] || key.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Pricing ───────────────────────────────────────────────────────────

function ViewPricing({ property }: { property: StPropertyData }) {
  const methods = parsePaymentMethods(property.acceptedPaymentMethods);
  const showBank = methods.includes("bank_transfer");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Rates */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Rates</h3>
        </div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Nightly Rate" value={property.nightlyRate ? `AED ${property.nightlyRate}` : null} />
          <InfoRow label="Weekend Rate" value={property.weekendRate ? `AED ${property.weekendRate}` : null} />
          <InfoRow label="Minimum Stay" value={property.minimumStay ? `${property.minimumStay} night(s)` : null} />
        </div>
      </section>

      {/* Fees */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Fees</h3>
        </div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Cleaning Fee" value={property.cleaningFee ? `AED ${property.cleaningFee}` : null} />
          <InfoRow
            label="Security Deposit"
            value={
              property.securityDepositRequired
                ? property.securityDepositAmount
                  ? `AED ${property.securityDepositAmount}`
                  : "Required (amount not set)"
                : "Not required"
            }
          />
        </div>
      </section>

      {/* Payment Methods */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Guest Payment Methods</h3>
        </div>
        <Separator className="mb-4" />
        {methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment methods selected.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {methods.map((m: string) => (
              <div key={m} className="px-4 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20 capitalize">
                {m.replace(/_/g, " ")}
              </div>
            ))}
          </div>
        )}
        {showBank && (
          <div className="rounded-md border p-4">
            <h4 className="text-sm font-medium mb-3">Bank Transfer Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow label="Account Belongs To" value={property.bankAccountBelongsTo?.replace(/_/g, " ")} />
              <InfoRow label="Bank Name" value={property.bankName} />
              <InfoRow label="Account Holder" value={property.accountHolderName} />
              <InfoRow label="Account Number" value={property.accountNumber} />
              <InfoRow label="IBAN" value={property.iban} />
              <InfoRow label="SWIFT Code" value={property.swiftCode} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Tab: Policies ──────────────────────────────────────────────────────────

function ViewPolicies({ property }: { property: StPropertyData }) {
  const policies = property.policies || [];
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Check-in / Check-out */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Check-in & Check-out</h3>
        </div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Check-in Time" value={formatTime(property.checkInTime)} />
          <InfoRow label="Check-out Time" value={formatTime(property.checkOutTime)} />
        </div>
      </section>

      {/* Cancellation */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Cancellation Policy</h3>
        </div>
        <Separator className="mb-4" />
        <p className="text-sm font-medium">
          {CANCELLATION_LABELS[property.cancellationPolicy || ""] || property.cancellationPolicy || "—"}
        </p>
      </section>

      {/* House Rules */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">House Rules</h3>
          <span className="text-sm text-muted-foreground">({policies.length})</span>
        </div>
        <Separator className="mb-4" />
        {policies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom house rules.</p>
        ) : (
          <div className="space-y-2">
            {policies.map((p: any) => (
              <div key={p.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{p.name}</p>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Tab: Property Owner ────────────────────────────────────────────────────

function ViewOwner({ property }: { property: StPropertyData }) {
  // Fetch linked PO details if we have a poUserId
  const { data: linkedPOs = [] } = useQuery<any[]>({
    queryKey: ["/links", "PROPERTY_OWNER", "accepted"],
    queryFn: () => api.get("/links?targetRole=PROPERTY_OWNER&status=accepted"),
  });

  const selectedPO = linkedPOs.find((po: any) => po.targetUserId === property.poUserId);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Property Owner</h3>
        </div>
        <Separator className="mb-4" />
        {property.poUserId && selectedPO ? (
          <div className="rounded-md border p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow label="Name" value={selectedPO.targetName || "Unnamed"} />
              <InfoRow label="Email" value={selectedPO.targetEmail} />
              <InfoRow label="Phone" value={selectedPO.targetPhone} />
            </div>
          </div>
        ) : property.poUserId ? (
          <p className="text-sm text-muted-foreground">Property owner assigned (ID: {property.poUserId})</p>
        ) : (
          <p className="text-sm text-muted-foreground">No property owner assigned.</p>
        )}
      </section>

      {/* Commission */}
      {property.commissionType && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Percent className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Commission Structure</h3>
          </div>
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow
              label="Commission Type"
              value={
                property.commissionType === "fixed_monthly"
                  ? "Fixed Monthly"
                  : property.commissionType === "percentage_per_booking"
                    ? "Percentage per Booking"
                    : property.commissionType
              }
            />
            <InfoRow
              label="Commission Value"
              value={
                property.commissionValue
                  ? property.commissionType === "percentage_per_booking"
                    ? `${property.commissionValue}%`
                    : `AED ${property.commissionValue}`
                  : null
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Tab: Agreement ─────────────────────────────────────────────────────────

function ViewAgreement({ property }: { property: StPropertyData }) {
  const acq = property.acquisitionDetails || {};
  const documents = property.documents || [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Acquisition Type */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Acquisition Type</h3>
        </div>
        <Separator className="mb-4" />
        <InfoRow
          label="Type"
          value={
            <span className="capitalize">{property.acquisitionType?.replace(/_/g, " ") || "—"}</span>
          }
        />
      </section>

      {/* Cash Details */}
      {property.acquisitionType === "cash" && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Cash Details</h3>
          </div>
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="Purchase Price" value={acq.purchasePrice ? `AED ${acq.purchasePrice}` : null} />
            <InfoRow label="Purchase Date" value={acq.purchaseDate} />
          </div>
        </section>
      )}

      {/* Documents */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Documents</h3>
          <span className="text-sm text-muted-foreground">({documents.length})</span>
        </div>
        <Separator className="mb-4" />
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize">
                      {doc.documentType?.replace(/_/g, " ") || doc.name}
                    </p>
                    {doc.hasExpiry && doc.expiryDate && (
                      <p className="text-xs text-muted-foreground">
                        Expires: {doc.expiryDate}
                      </p>
                    )}
                  </div>
                </div>
                {doc.fileUrl && (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm flex items-center gap-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Utilities */}
      {property.acquisitionType && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Droplets className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Utilities</h3>
          </div>
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="DEWA Number" value={acq.dewaNo} />
            <InfoRow label="Internet Provider" value={acq.internetProvider} />
            <InfoRow label="Internet Account No." value={acq.internetAccountNo} />
            <InfoRow label="Gas Number" value={acq.gasNo} />
          </div>
        </section>
      )}

      {/* Confirmation */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Confirmation</h3>
        </div>
        <Separator className="mb-4" />
        <InfoRow
          label="Agreement Confirmed"
          value={
            property.agreementConfirmed || property.confirmed
              ? <span className="flex items-center gap-1.5 text-green-600"><Check className="h-4 w-4" /> Confirmed</span>
              : <span className="flex items-center gap-1.5 text-muted-foreground"><X className="h-4 w-4" /> Not confirmed</span>
          }
        />
      </section>
    </div>
  );
}

// ─── Tab: Investment ────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "maintenance", label: "Maintenance" },
  { value: "renovation", label: "Renovation" },
  { value: "furnishing", label: "Furnishing" },
  { value: "insurance", label: "Insurance" },
  { value: "service_charge", label: "Service Charge" },
  { value: "utility", label: "Utility" },
  { value: "management_fee", label: "Management Fee" },
  { value: "legal", label: "Legal" },
  { value: "government_fee", label: "Government Fee" },
  { value: "commission", label: "Commission" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  maintenance: "bg-blue-100 text-blue-700",
  renovation: "bg-purple-100 text-purple-700",
  furnishing: "bg-amber-100 text-amber-700",
  insurance: "bg-green-100 text-green-700",
  service_charge: "bg-cyan-100 text-cyan-700",
  utility: "bg-orange-100 text-orange-700",
  management_fee: "bg-pink-100 text-pink-700",
  legal: "bg-red-100 text-red-700",
  government_fee: "bg-indigo-100 text-indigo-700",
  commission: "bg-yellow-100 text-yellow-700",
  other: "bg-gray-100 text-gray-700",
};

function formatCurrency(amount: string | number | null | undefined) {
  if (!amount) return "AED 0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `AED ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDateShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ExpenseFormData {
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
  receiptUrl: string;
  billImageUrl: string;
  paymentStatus: string;
  paidDate: string;
  paymentProofUrl: string;
  responsibleParty: string;
  paidBy: string;
  notes: string;
}

function ExpenseDialog({
  open,
  onClose,
  propertyId,
  editExpense,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  editExpense?: any;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ExpenseFormData>({
    category: editExpense?.category || "",
    description: editExpense?.description || "",
    amount: editExpense?.amount || "",
    expenseDate: editExpense?.expenseDate || new Date().toISOString().split("T")[0],
    receiptUrl: editExpense?.receiptUrl || "",
    billImageUrl: editExpense?.billImageUrl || "",
    paymentStatus: editExpense?.paymentStatus || "unpaid",
    paidDate: editExpense?.paidDate?.slice?.(0, 10) || "",
    paymentProofUrl: editExpense?.paymentProofUrl || "",
    responsibleParty: editExpense?.responsibleParty || "",
    paidBy: editExpense?.paidBy || "",
    notes: editExpense?.notes || "",
  });
  const [uploading, setUploading] = useState<string | null>(null);

  const uploadFile = async (field: "billImageUrl" | "paymentProofUrl", file: File) => {
    setUploading(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (data.url) setForm(f => ({ ...f, [field]: data.url }));
    } catch {} finally { setUploading(null); }
  };

  const mutation = useMutation({
    mutationFn: (data: ExpenseFormData) => {
      if (editExpense) {
        return api.patch(`/st-properties/${propertyId}/expenses/${editExpense.id}`, data);
      }
      return api.post(`/st-properties/${propertyId}/expenses`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${propertyId}/expenses`] });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${propertyId}/investment-summary`] });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${propertyId}/transactions`] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Row 1: Category + Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (AED) <span className="text-destructive">*</span></Label>
              <Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>

          {/* Row 2: Date + Description */}
          <div>
            <Label>Expense Date <span className="text-destructive">*</span></Label>
            <Input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea placeholder="Brief description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>

          {/* Bill Image */}
          <div>
            <Label>Bill / Invoice Image</Label>
            <div className="flex items-center gap-3">
              <input type="file" accept="image/*,.pdf" className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground file:cursor-pointer"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile("billImageUrl", f); }} />
              {uploading === "billImageUrl" && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            {form.billImageUrl && <img src={form.billImageUrl} alt="Bill" className="mt-2 max-h-24 rounded border" />}
          </div>

          <Separator />

          {/* Responsibility */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Responsible Party <span className="text-destructive">*</span></Label>
              <Select value={form.responsibleParty || "none"} onValueChange={(v) => setForm({ ...form, responsibleParty: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="property_manager">Property Manager</SelectItem>
                  <SelectItem value="property_owner">Property Owner</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paid By <span className="text-destructive">*</span></Label>
              <Select value={form.paidBy || "none"} onValueChange={(v) => setForm({ ...form, paidBy: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="property_manager">Property Manager</SelectItem>
                  <SelectItem value="property_owner">Property Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Payment Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Status <span className="text-destructive">*</span></Label>
              <Select value={form.paymentStatus} onValueChange={(v) => setForm({ ...form, paymentStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partially Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.paymentStatus === "paid" || form.paymentStatus === "partial") && (
              <div>
                <Label>Paid Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.paidDate} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} />
              </div>
            )}
          </div>

          {/* Payment Proof */}
          {(form.paymentStatus === "paid" || form.paymentStatus === "partial") && (
            <div>
              <Label>Payment Proof</Label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*,.pdf" className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground file:cursor-pointer"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile("paymentProofUrl", f); }} />
                {uploading === "paymentProofUrl" && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {form.paymentProofUrl && <img src={form.paymentProofUrl} alt="Proof" className="mt-2 max-h-24 rounded border" />}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea placeholder="Additional notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!form.category || !form.amount || !form.expenseDate || !form.responsibleParty || !form.paidBy || !form.paymentStatus || ((form.paymentStatus === "paid" || form.paymentStatus === "partial") && !form.paidDate) || mutation.isPending}
              onClick={() => mutation.mutate(form)}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editExpense ? "Update" : "Add Expense"}
            </Button>
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-500">Failed to save expense. Please try again.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: Smart Locks ──────────────────────────────────────────────────────────

const LOCK_BRANDS = ["Schlage", "Yale", "August", "Nuki", "Igloohome", "TTLock", "Samsung", "Other"];
const LOCK_LOCATIONS = ["Front Door", "Back Door", "Gate", "Garage", "Safe Box", "Other"];

function ViewLocks({ property }: { property: StPropertyData }) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("properties.edit");
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", brand: "", model: "", deviceId: "", location: "", apiKey: "" });

  const { data: locks = [] } = useQuery<any[]>({
    queryKey: [`/st-properties/${property.id}/locks`],
    queryFn: () => api.get(`/st-properties/${property.id}/locks`),
  });

  const { data: pinHistory = [] } = useQuery<any[]>({
    queryKey: [`/st-properties/${property.id}/lock-pins`],
    queryFn: () => api.get(`/st-properties/${property.id}/lock-pins`),
  });

  const addMut = useMutation({
    mutationFn: () => api.post(`/st-properties/${property.id}/locks`, form),
    onSuccess: () => {
      toast({ title: "Lock added" });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/locks`] });
      setAddOpen(false);
      setForm({ name: "", brand: "", model: "", deviceId: "", location: "", apiKey: "" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ lockId, isActive }: { lockId: string; isActive: boolean }) =>
      api.patch(`/st-properties/${property.id}/locks/${lockId}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/locks`] }),
  });

  const deleteMut = useMutation({
    mutationFn: (lockId: string) => api.delete(`/st-properties/${property.id}/locks/${lockId}`),
    onSuccess: () => { toast({ title: "Lock removed" }); queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/locks`] }); },
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Smart Locks</h3>
        </div>
        {canEdit && <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Lock</Button>}
      </div>
      <Separator className="mb-6" />

      {/* Lock Cards */}
      {locks.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Key className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No smart locks configured.</p>
          <p className="text-xs text-muted-foreground mt-1">Add a lock to auto-generate PINs for guests.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {locks.map((lock: any) => (
            <Card key={lock.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      {lock.name}
                      <Badge className={`text-[10px] border-0 ${lock.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                        {lock.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </p>
                    <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                      {lock.brand && <p>Brand: {lock.brand} {lock.model ? `— ${lock.model}` : ""}</p>}
                      {lock.deviceId && <p>Device: <span className="font-mono text-xs">{lock.deviceId}</span></p>}
                      {lock.location && <p>Location: {lock.location}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{lock.activePins} active PIN(s)</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleMut.mutate({ lockId: lock.id, isActive: !lock.isActive })}>
                        {lock.isActive ? <span className="text-xs">⏸</span> : <span className="text-xs">▶</span>}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(lock.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* PIN History */}
      {pinHistory.length > 0 && (
        <>
          <h4 className="text-sm font-semibold mb-3">PIN History</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-2 font-medium">PIN</th>
                  <th className="px-4 py-2 font-medium">Guest</th>
                  <th className="px-4 py-2 font-medium">Lock</th>
                  <th className="px-4 py-2 font-medium">Valid From</th>
                  <th className="px-4 py-2 font-medium">Valid Until</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pinHistory.map((p: any) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5 font-mono font-bold text-lg">{p.pin}</td>
                    <td className="px-4 py-2.5">{p.guestName}<br /><span className="text-xs text-muted-foreground">{p.checkIn?.slice(0, 10)} – {p.checkOut?.slice(0, 10)}</span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.lockName}<br /><span className="text-xs">{p.lockLocation}</span></td>
                    <td className="px-4 py-2.5 text-xs">{p.validFrom ? new Date(p.validFrom).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{p.validUntil ? new Date(p.validUntil).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={`text-[10px] border-0 ${p.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Lock Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Smart Lock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Lock Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Front Door Lock" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <select value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {LOCK_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g. Encode Plus" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Device ID</Label>
              <Input value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))} placeholder="e.g. SCHLAGE-MG1-2304" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
                <option value="">Select...</option>
                {LOCK_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>API Key (optional)</Label>
              <Input value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="For future lock API integration" type="password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button disabled={!form.name.trim() || addMut.isPending} onClick={() => addMut.mutate()}>
              {addMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Inventory ──────────────────────────────────────────────────────────

const INVENTORY_CATEGORIES = [
  "Furniture", "Electronics", "Appliances", "Kitchenware", "Linens & Towels",
  "Decor", "Bathroom", "Outdoor", "Safety Equipment", "Other",
];

const INVENTORY_CONDITIONS = ["New", "Good", "Fair", "Poor", "Damaged"];

const INVENTORY_LOCATIONS = [
  "Living Room", "Master Bedroom", "Guest Bedroom", "Kitchen",
  "Bathroom", "Balcony", "Storage", "Hallway", "Maid Room",
];

const INV_CATEGORY_COLORS: Record<string, string> = {
  Furniture: "bg-blue-100 text-blue-800",
  Electronics: "bg-purple-100 text-purple-800",
  Appliances: "bg-orange-100 text-orange-800",
  Kitchenware: "bg-amber-100 text-amber-800",
  "Linens & Towels": "bg-teal-100 text-teal-800",
  Decor: "bg-pink-100 text-pink-800",
  Bathroom: "bg-cyan-100 text-cyan-800",
  Outdoor: "bg-green-100 text-green-800",
  "Safety Equipment": "bg-red-100 text-red-800",
  Other: "bg-gray-100 text-gray-800",
};

function ViewInventory({ property }: { property: StPropertyData }) {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("properties.edit");
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [form, setForm] = useState({
    name: "", category: "Furniture", quantity: "1", unitCost: "", condition: "New",
    purchaseDate: "", location: "", notes: "",
  });

  const { data: items = [] } = useQuery<any[]>({
    queryKey: [`/st-properties/${property.id}/inventory`],
    queryFn: () => api.get(`/st-properties/${property.id}/inventory`),
  });

  const { data: summary } = useQuery<any>({
    queryKey: [`/st-properties/${property.id}/inventory-summary`],
    queryFn: () => api.get(`/st-properties/${property.id}/inventory-summary`),
  });

  const addMut = useMutation({
    mutationFn: (data: any) => editItem
      ? api.patch(`/st-properties/${property.id}/inventory/${editItem.id}`, data)
      : api.post(`/st-properties/${property.id}/inventory`, data),
    onSuccess: () => {
      toast({ title: editItem ? "Item updated" : "Item added" });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/inventory`] });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/inventory-summary`] });
      setAddOpen(false); setEditItem(null);
      setForm({ name: "", category: "Furniture", quantity: "1", unitCost: "", condition: "New", purchaseDate: "", location: "", notes: "" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (itemId: string) => api.delete(`/st-properties/${property.id}/inventory/${itemId}`),
    onSuccess: () => {
      toast({ title: "Item removed" });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/inventory`] });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/inventory-summary`] });
    },
  });

  const openEdit = (item: any) => {
    setForm({
      name: item.name, category: item.category, quantity: String(item.quantity),
      unitCost: item.unitCost, condition: item.condition,
      purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : "",
      location: item.location || "", notes: item.notes || "",
    });
    setEditItem(item);
    setAddOpen(true);
  };

  const filtered = filterCat === "all" ? items : items.filter(i => i.category === filterCat);
  const totalValue = parseFloat(summary?.totalValue || "0");

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Inventory</h3>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditItem(null); setForm({ name: "", category: "Furniture", quantity: "1", unitCost: "", condition: "New", purchaseDate: "", location: "", notes: "" }); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        )}
      </div>
      <Separator className="mb-6" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border p-4 bg-blue-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Inventory Value</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(summary?.totalValue)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-emerald-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Items</p>
          <p className="text-xl font-bold text-emerald-700">{summary?.totalItems || 0} items ({summary?.totalQuantity || 0} units)</p>
        </div>
        <div className="rounded-lg border p-4 bg-purple-50/50">
          <p className="text-xs text-muted-foreground mb-1">Categories</p>
          <p className="text-xl font-bold text-purple-700">{summary?.categoryBreakdown?.length || 0}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {summary?.categoryBreakdown?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {summary.categoryBreakdown.map((cat: any) => {
            const pct = totalValue > 0 ? ((parseFloat(cat.totalCost) / totalValue) * 100).toFixed(0) : "0";
            return (
              <div key={cat.category} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-accent/50"
                onClick={() => setFilterCat(filterCat === cat.category ? "all" : cat.category)}>
                <Badge className={INV_CATEGORY_COLORS[cat.category] || "bg-gray-100 text-gray-700"}>{cat.category}</Badge>
                <span className="font-medium">{formatCurrency(cat.totalCost)}</span>
                <span className="text-muted-foreground text-xs">({pct}%)</span>
              </div>
            );
          })}
          {filterCat !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setFilterCat("all")}>Clear filter</Button>
          )}
        </div>
      )}

      {/* Items Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{items.length === 0 ? "No inventory items yet." : "No items in this category."}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium text-center">Qty</th>
                <th className="px-4 py-2 font-medium text-right">Unit Cost</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium">Condition</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => {
                const condColor = item.condition === "New" || item.condition === "Good" ? "text-green-700" : item.condition === "Damaged" || item.condition === "Poor" ? "text-red-700" : "text-yellow-700";
                return (
                  <tr key={item.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{item.name}</p>
                      {item.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.notes}</p>}
                    </td>
                    <td className="px-4 py-2.5"><Badge className={`text-[10px] border-0 ${INV_CATEGORY_COLORS[item.category] || ""}`}>{item.category}</Badge></td>
                    <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(item.unitCost)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(item.totalCost)}</td>
                    <td className={`px-4 py-2.5 ${condColor}`}>{item.condition}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{item.location || "—"}</td>
                    <td className="px-4 py-2.5">
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditItem(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Item Name <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder='e.g. Samsung 55" Smart TV' />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
                  {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Condition</Label>
                <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
                  {INVENTORY_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Cost (AED)</Label>
                <Input type="number" min="0" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" value={form.purchaseDate} max={new Date().toISOString().split("T")[0]} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {INVENTORY_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Brand, model, warranty, supplier..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setEditItem(null); }}>Cancel</Button>
            <Button disabled={addMut.isPending || !form.name.trim()} onClick={() => {
              if (form.purchaseDate && form.purchaseDate > new Date().toISOString().split("T")[0]) {
                toast({ title: "Validation Error", description: "Purchase date cannot be in the future", variant: "destructive" });
                return;
              }
              addMut.mutate({
                name: form.name, category: form.category, quantity: parseInt(form.quantity) || 1,
                unitCost: form.unitCost || "0", condition: form.condition,
                purchaseDate: form.purchaseDate || null, location: form.location || null, notes: form.notes || null,
              });
            }}>
              {addMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editItem ? "Save" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Investment ──────────────────────────────────────────────────────────

function ViewInvestment({ property }: { property: StPropertyData }) {
  const { data: summary } = useQuery<{
    purchasePrice: string;
    purchaseDate: string | null;
    acquisitionType: string | null;
    totalExpenses: string;
    expenseCount: number;
    totalInvestment: string;
    categoryBreakdown: { category: string; total: string; count: number }[];
    totalIncome: string;
    bookingCount: number;
    totalSubtotal: string;
    totalCleaningFees: string;
    totalCommission: string;
    totalOwnerPayout: string;
    netProfit: string;
    depositsCollected: string;
    depositsReturned: string;
    depositsHeld: string;
    depositsForfeited: string;
  }>({
    queryKey: [`/st-properties/${property.id}/investment-summary`],
    queryFn: () => api.get(`/st-properties/${property.id}/investment-summary`),
  });

  const { data: expenses } = useQuery<any[]>({
    queryKey: [`/st-properties/${property.id}/expenses`],
    queryFn: () => api.get(`/st-properties/${property.id}/expenses`),
  });

  const totalExpenses = parseFloat(summary?.totalExpenses || "0");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Investment Overview</h3>
      </div>
      <Separator className="mb-6" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border p-4 bg-blue-50/50">
          <p className="text-xs text-muted-foreground mb-1">Purchase Price</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(summary?.purchasePrice)}</p>
          {summary?.purchaseDate && (
            <p className="text-xs text-muted-foreground mt-1">Purchased {formatDateShort(summary.purchaseDate)}</p>
          )}
          {summary?.acquisitionType && (
            <Badge variant="secondary" className="mt-2 text-[10px]">
              {summary.acquisitionType.replace(/_/g, " ").toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="rounded-lg border p-4 bg-indigo-50/50">
          <p className="text-xs text-muted-foreground mb-1">Furnishing & Inventory</p>
          <p className="text-xl font-bold text-indigo-700">{formatCurrency(summary?.inventoryValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">Physical assets</p>
        </div>
        <div className="rounded-lg border p-4 bg-orange-50/50">
          <p className="text-xs text-muted-foreground mb-1">Additional Expenses</p>
          <p className="text-xl font-bold text-orange-700">{formatCurrency(summary?.totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-1">{summary?.expenseCount || 0} expense(s)</p>
        </div>
        <div className="rounded-lg border p-4 bg-green-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Investment</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(summary?.totalInvestment)}</p>
          <p className="text-xs text-muted-foreground mt-1">Purchase + inventory + expenses</p>
        </div>
      </div>

      {/* Revenue */}
      <h4 className="text-sm font-semibold mb-3">Revenue</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border p-4 bg-emerald-50/50">
          <p className="text-xs text-muted-foreground mb-1">Rental Revenue</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(summary?.totalIncome)}</p>
          <p className="text-xs text-muted-foreground mt-1">{summary?.bookingCount || 0} booking(s) — excl. deposits</p>
        </div>
        <div className="rounded-lg border p-4 bg-purple-50/50">
          <p className="text-xs text-muted-foreground mb-1">PM Commission</p>
          <p className="text-xl font-bold text-purple-700">-{formatCurrency(summary?.totalCommission)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-cyan-50/50">
          <p className="text-xs text-muted-foreground mb-1">Owner Payout</p>
          <p className="text-xl font-bold text-cyan-700">{formatCurrency(summary?.totalOwnerPayout)}</p>
        </div>
      </div>

      {/* Costs & Net Profit */}
      <h4 className="text-sm font-semibold mb-3">Costs & Net Profit</h4>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="rounded-lg border p-4 bg-purple-50/50">
          <p className="text-xs text-muted-foreground mb-1">PM Commission</p>
          <p className="text-lg font-bold text-purple-700">{formatCurrency(summary?.totalCommission)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-indigo-50/50">
          <p className="text-xs text-muted-foreground mb-1">Inventory</p>
          <p className="text-lg font-bold text-indigo-700">{formatCurrency(summary?.inventoryValue)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-orange-50/50">
          <p className="text-xs text-muted-foreground mb-1">Expenses</p>
          <p className="text-lg font-bold text-orange-700">{formatCurrency(summary?.totalExpenses)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-red-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Costs</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(summary?.totalCosts)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${parseFloat(summary?.netProfit || "0") >= 0 ? "bg-green-50/50" : "bg-red-50/50"}`}>
          <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
          <p className={`text-xl font-bold ${parseFloat(summary?.netProfit || "0") >= 0 ? "text-green-700" : "text-red-700"}`}>
            {formatCurrency(summary?.netProfit)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Revenue - Commission - Inventory - Expenses</p>
        </div>
      </div>

      {/* Security Deposit Cards */}
      <h4 className="text-sm font-semibold mb-3">Security Deposits</h4>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border p-4 bg-slate-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Collected</p>
          <p className="text-xl font-bold text-slate-700">{formatCurrency(summary?.depositsCollected)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-amber-50/50">
          <p className="text-xs text-muted-foreground mb-1">Currently Held</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(summary?.depositsHeld)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-teal-50/50">
          <p className="text-xs text-muted-foreground mb-1">Returned</p>
          <p className="text-xl font-bold text-teal-700">{formatCurrency(summary?.depositsReturned)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-red-50/50">
          <p className="text-xs text-muted-foreground mb-1">Forfeited</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(summary?.depositsForfeited)}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0 && (
        <div className="mb-8">
          <h4 className="text-sm font-semibold mb-3">Expense Breakdown by Category</h4>
          <div className="flex flex-wrap gap-2">
            {summary.categoryBreakdown.map((cat) => {
              const label = EXPENSE_CATEGORIES.find((c) => c.value === cat.category)?.label || cat.category;
              const pct = totalExpenses > 0 ? ((parseFloat(cat.total) / totalExpenses) * 100).toFixed(0) : "0";
              return (
                <div key={cat.category} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <Badge className={CATEGORY_COLORS[cat.category] || "bg-gray-100 text-gray-700"}>
                    {label}
                  </Badge>
                  <span className="font-medium">{formatCurrency(cat.total)}</span>
                  <span className="text-muted-foreground text-xs">({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <TransactionHistory propertyId={property.id} />
    </div>
  );
}

// ─── Transaction History Component ──────────────────────────────────────────

const TX_TYPE_STYLES: Record<string, { badge: string; icon: string }> = {
  purchase: { badge: "bg-blue-100 text-blue-800", icon: "text-blue-600" },
  expense: { badge: "bg-orange-100 text-orange-800", icon: "text-orange-600" },
  booking_income: { badge: "bg-emerald-100 text-emerald-800", icon: "text-emerald-600" },
  security_deposit_in: { badge: "bg-amber-100 text-amber-800", icon: "text-amber-600" },
  security_deposit_out: { badge: "bg-teal-100 text-teal-800", icon: "text-teal-600" },
  security_deposit_forfeited: { badge: "bg-red-100 text-red-800", icon: "text-red-600" },
  commission: { badge: "bg-purple-100 text-purple-800", icon: "text-purple-600" },
  inventory: { badge: "bg-indigo-100 text-indigo-800", icon: "text-indigo-600" },
};

function TransactionHistory({ propertyId }: { propertyId: string }) {
  const { data: transactions } = useQuery<any[]>({
    queryKey: [`/st-properties/${propertyId}/transactions`],
    queryFn: () => api.get(`/st-properties/${propertyId}/transactions`),
  });

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">Transaction History</h4>
      {!transactions || transactions.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No transactions recorded yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any) => {
                const style = TX_TYPE_STYLES[tx.type] || { badge: "bg-gray-100 text-gray-700", icon: "" };
                const amountStr = tx.amount?.toString() || "0";
                const isPositive = amountStr.startsWith("+");
                const isNegative = amountStr.startsWith("-");
                const isHold = tx.direction === "hold";
                const amountColor = isPositive ? "text-emerald-700" : isNegative ? "text-red-700" : isHold ? "text-amber-700" : "";
                const displayAmount = isHold
                  ? `AED ${parseFloat(amountStr).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} (held)`
                  : `${isPositive ? "+" : isNegative ? "-" : ""}AED ${Math.abs(parseFloat(amountStr)).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

                return (
                  <tr key={tx.id} className="border-t hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {tx.date ? formatDateShort(tx.date) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={cn("text-[11px] border-0", style.badge)}>
                        {tx.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 truncate max-w-[250px]">{tx.description || "—"}</td>
                    <td className={cn("px-4 py-2.5 text-right font-semibold whitespace-nowrap", amountColor)}>
                      {displayAmount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Bookings ──────────────────────────────────────────────────────────

const BOOKING_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  requested: { label: "Requested", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800 border-blue-300" },
  checked_in: { label: "Checked In", color: "bg-green-100 text-green-800 border-green-300" },
  checked_out: { label: "Checked Out", color: "bg-orange-100 text-orange-800 border-orange-300" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 border-red-300" },
  declined: { label: "Declined", color: "bg-gray-100 text-gray-800 border-gray-300" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500 border-gray-300" },
};

function BookingStatusBadge({ status }: { status: string }) {
  const cfg = BOOKING_STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-800 border-gray-300" };
  return <Badge variant="outline" className={cn("text-xs font-medium border", cfg.color)}>{cfg.label}</Badge>;
}

function bookingFormatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function bookingFormatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "AED" }).format(v);
}

// ─── Calendar Sub-view ──────────────────────────────────────────────────────

function BookingCalendarView({
  bookings,
  blocked,
}: {
  bookings: any[];
  blocked: any[];
}) {
  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(current.year, current.month, 1).getDay();
  const monthLabel = new Date(current.year, current.month).toLocaleString("default", { month: "long", year: "numeric" });

  const prev = () => setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  const next = () => setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });

  const dayStr = (day: number) => {
    const m = String(current.month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${current.year}-${m}-${d}`;
  };

  const isInRange = (ds: string, checkIn: string, checkOut: string) => ds >= checkIn.slice(0, 10) && ds <= checkOut.slice(0, 10);

  const cells: (number | null)[] = (Array.from({ length: firstDayOfWeek }, () => null) as (number | null)[]).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedDayBookings = selectedDay
    ? bookings.filter(b => isInRange(dayStr(selectedDay), b.checkInDate, b.checkOutDate))
    : [];
  const selectedDayBlocked = selectedDay
    ? blocked.filter(bl => isInRange(dayStr(selectedDay), bl.startDate, bl.endDate))
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold text-sm">{monthLabel}</span>
        <Button variant="outline" size="sm" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-center text-xs font-medium py-2 bg-muted-foreground/5">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="min-h-[72px] bg-background" />;
          const ds = dayStr(day);
          const dayBookings = bookings.filter(b => isInRange(ds, b.checkInDate, b.checkOutDate));
          const dayBlocked = blocked.filter(bl => isInRange(ds, bl.startDate, bl.endDate));
          const isSelected = selectedDay === day;
          return (
            <div
              key={day}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "min-h-[72px] p-1 bg-background cursor-pointer hover:bg-muted/50 transition-colors",
                isSelected && "ring-2 ring-primary ring-inset"
              )}
            >
              <span className="text-xs font-medium">{day}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayBookings.slice(0, 2).map(b => {
                  const cfg = BOOKING_STATUS_CONFIG[b.status];
                  return (
                    <div key={b.id} className={cn("text-[10px] leading-tight px-1 rounded truncate", cfg?.color ?? "bg-gray-100")}>
                      {b.guestName?.split(" ")[0] || "Guest"}
                    </div>
                  );
                })}
                {dayBookings.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayBookings.length - 2} more</div>}
                {dayBlocked.map(bl => (
                  <div key={bl.id} className="text-[10px] leading-tight px-1 rounded bg-gray-200 text-gray-600 truncate">
                    Blocked
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {selectedDay && (
        <div className="mt-4 border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2">
            {new Date(current.year, current.month, selectedDay).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </h4>
          {selectedDayBookings.length === 0 && selectedDayBlocked.length === 0 && (
            <p className="text-sm text-muted-foreground">No bookings or blocks on this day.</p>
          )}
          {selectedDayBookings.map(b => (
            <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <div>
                <span className="font-medium">{b.guestName || "Guest"}</span>
                <span className="text-muted-foreground ml-2">{bookingFormatDate(b.checkInDate)} – {bookingFormatDate(b.checkOutDate)}</span>
              </div>
              <BookingStatusBadge status={b.status} />
            </div>
          ))}
          {selectedDayBlocked.map(bl => (
            <div key={bl.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <div>
                <span className="font-medium text-gray-600">Blocked</span>
                <span className="text-muted-foreground ml-2">{bookingFormatDate(bl.startDate)} – {bookingFormatDate(bl.endDate)}</span>
              </div>
              <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">{bl.reason || "No reason"}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ViewBookings Component ────────────────────────────────────────────

function ViewBookings({ property }: { property: StPropertyData }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManageBookings = hasPermission("bookings.manage");

  // ── State ──
  const [view, setView] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialogs
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const [blockDatesOpen, setBlockDatesOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineBookingId, setDeclineBookingId] = useState<string | null>(null);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutBookingId, setCheckoutBookingId] = useState<string | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [depositBookingId, setDepositBookingId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<any>(null);
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);

  const { data: fullDetailBooking } = useQuery<any>({
    queryKey: ["/bookings", detailBookingId],
    queryFn: () => api.get(`/bookings/${detailBookingId}`),
    enabled: !!detailBookingId && detailDialogOpen,
  });

  // Manual booking form
  const [mbForm, setMbForm] = useState({
    guestName: "", guestEmail: "", guestPhone: "", checkIn: "", checkOut: "",
    guests: "1", source: "website", externalRef: "", paymentMethod: "", notes: "",
  });

  // Block dates form
  const [bdForm, setBdForm] = useState({ startDate: "", endDate: "", reason: "" });

  // Decline form
  const [declineReason, setDeclineReason] = useState("");

  // Checkout form
  const DEFAULT_CHECKOUT_CHECKLIST = [
    { label: "Keys / access cards returned", completed: false },
    { label: "Property condition inspected", completed: false },
    { label: "Inventory checked — no missing items", completed: false },
    { label: "Damages documented (if any)", completed: false },
    { label: "Security deposit assessment done", completed: false },
    { label: "Guest reminded to leave a review", completed: false },
  ];
  const [coForm, setCoForm] = useState({
    condition: "good",
    damageNotes: "",
    damagePhotos: "",
    checklist: DEFAULT_CHECKOUT_CHECKLIST,
  });

  // Deposit form
  const [depForm, setDepForm] = useState<{ returnType: string; deductions: { reason: string; amount: string }[] }>({
    returnType: "full", deductions: [],
  });

  // ── Queries ──
  const { data: bookings = [], isLoading } = useQuery<any[]>({
    queryKey: ["bookings", "property", property.id],
    queryFn: () => api.get(`/bookings/property/${property.id}`),
  });

  const { data: calendarData } = useQuery<{ bookings: any[]; blocked: any[] }>({
    queryKey: ["bookings", "calendar", property.id],
    queryFn: () => api.get(`/bookings/property/${property.id}/calendar`),
    enabled: view === "calendar",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bookings", "property", property.id] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "calendar", property.id] });
  };

  // ── Mutations ──
  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/confirm`),
    onSuccess: () => { invalidate(); toast({ title: "Booking confirmed" }); },
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/bookings/${id}/decline`, { reason }),
    onSuccess: () => { invalidate(); setDeclineDialogOpen(false); setDeclineReason(""); toast({ title: "Booking declined" }); },
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/check-in`),
    onSuccess: (data: any) => {
      invalidate();
      const pin = data?.data?.accessPin;
      toast({ title: "Guest checked in", description: pin ? `Access PIN: ${pin}` : undefined });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; checklistItems?: any[]; damageAssessment?: any }) =>
      api.patch(`/bookings/${id}/check-out`, body),
    onSuccess: () => {
      invalidate(); setCheckoutDialogOpen(false);
      setCoForm({ condition: "good", damageNotes: "", damagePhotos: "", checklist: DEFAULT_CHECKOUT_CHECKLIST });
      toast({ title: "Guest checked out" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/complete`),
    onSuccess: () => { invalidate(); toast({ title: "Booking completed" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/cancel`),
    onSuccess: () => { invalidate(); toast({ title: "Booking cancelled" }); },
  });

  const manualBookingMutation = useMutation({
    mutationFn: (body: any) => api.post("/bookings/manual", body),
    onSuccess: () => {
      invalidate(); setManualBookingOpen(false);
      setMbForm({ guestName: "", guestEmail: "", guestPhone: "", checkIn: "", checkOut: "", guests: "1", source: "website", externalRef: "", paymentMethod: "", notes: "" });
      toast({ title: "Booking created" });
    },
  });

  const blockDatesMutation = useMutation({
    mutationFn: (body: any) => api.post("/bookings/block-dates", body),
    onSuccess: () => {
      invalidate(); setBlockDatesOpen(false);
      setBdForm({ startDate: "", endDate: "", reason: "" });
      toast({ title: "Dates blocked" });
    },
  });

  const depositReturnMutation = useMutation({
    mutationFn: ({ id, returnType, deductions }: { id: string; returnType: string; deductions: { reason: string; amount: number }[] }) => {
      // Find the booking to get the deposit amount
      const booking = bookings.find(b => b.id === id);
      const depositAmount = parseFloat(booking?.securityDepositAmount || "0");
      const totalDeductions = deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
      const returnedAmount = returnType === "full" ? depositAmount : Math.max(0, depositAmount - totalDeductions);
      return api.post(`/bookings/${id}/deposit/return`, { returnedAmount, deductions, notes: null });
    },
    onSuccess: () => {
      invalidate(); setDepositDialogOpen(false);
      setDepForm({ returnType: "full", deductions: [] });
      toast({ title: "Deposit returned" });
    },
  });

  const payoutMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/payout`),
    onSuccess: () => { invalidate(); toast({ title: "Payout marked complete" }); },
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bookings/block-dates/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Dates unblocked" }); },
  });

  // ── Derived ──
  const filtered = bookings
    .filter(b => statusFilter === "all" || b.status === statusFilter)
    .filter(b => !searchQuery || (b.guestName ?? "").toLowerCase().includes(searchQuery.toLowerCase()));

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === "requested").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    checkedIn: bookings.filter(b => b.status === "checked_in").length,
  };

  // ── Render ──
  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Bookings</h3>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
            <Filter className="h-3.5 w-3.5 mr-1" /> List
          </Button>
          <Button variant={view === "calendar" ? "default" : "outline"} size="sm" onClick={() => setView("calendar")}>
            <Calendar className="h-3.5 w-3.5 mr-1" /> Calendar
          </Button>
        </div>
      </div>
      <Separator className="mb-6" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, icon: CalendarDays, color: "text-primary" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-600" },
          { label: "Confirmed", value: stats.confirmed, icon: Check, color: "text-blue-600" },
          { label: "Checked In", value: stats.checkedIn, icon: LogIn, color: "text-green-600" },
        ].map(s => (
          <div key={s.label} className="border rounded-lg p-3 flex items-center gap-3">
            <s.icon className={cn("h-5 w-5", s.color)} />
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by guest name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(BOOKING_STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManageBookings && (
          <>
            <Button size="sm" onClick={() => setManualBookingOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Booking
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBlockDatesOpen(true)}>
              <Ban className="h-4 w-4 mr-1" /> Block Dates
            </Button>
          </>
        )}
      </div>

      {/* List View */}
      {view === "list" && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-muted-foreground mb-1">No Bookings Found</h4>
              <p className="text-sm text-muted-foreground">
                {bookings.length === 0
                  ? "Bookings for this property will appear here."
                  : "No bookings match your current filters."}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="px-3 py-2.5 font-medium">Guest</th>
                      <th className="px-3 py-2.5 font-medium">Dates</th>
                      <th className="px-3 py-2.5 font-medium text-center">Nights</th>
                      <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Payment</th>
                      <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(b => (
                      <tr
                        key={b.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => { setDetailBooking(b); setDetailBookingId(b.id); setDetailDialogOpen(true); }}
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-medium truncate max-w-[140px]">{b.guestName || "—"}</p>
                          {b.source && <p className="text-xs text-muted-foreground capitalize">{b.source.replace("_", ".")}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {bookingFormatDate(b.checkInDate)} – {bookingFormatDate(b.checkOutDate)}
                        </td>
                        <td className="px-3 py-2.5 text-center">{b.totalNights ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{bookingFormatCurrency(b.totalAmount)}</td>
                        <td className="px-3 py-2.5"><BookingStatusBadge status={b.status} /></td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs capitalize">{b.paymentStatus ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {b.status === "requested" && (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => confirmMutation.mutate(b.id)} disabled={confirmMutation.isPending}>
                                  <Check className="h-3 w-3 mr-1" /> Confirm
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => { setDeclineBookingId(b.id); setDeclineDialogOpen(true); }}>
                                  <X className="h-3 w-3 mr-1" /> Decline
                                </Button>
                              </>
                            )}
                            {b.status === "confirmed" && (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => checkInMutation.mutate(b.id)} disabled={checkInMutation.isPending}>
                                  <LogIn className="h-3 w-3 mr-1" /> Check In
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => cancelMutation.mutate(b.id)} disabled={cancelMutation.isPending}>
                                  <XCircle className="h-3 w-3 mr-1" /> Cancel
                                </Button>
                              </>
                            )}
                            {b.status === "checked_in" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setCheckoutBookingId(b.id); setCheckoutDialogOpen(true); }}>
                                <LogOut className="h-3 w-3 mr-1" /> Check Out
                              </Button>
                            )}
                            {b.status === "checked_out" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => completeMutation.mutate(b.id)} disabled={completeMutation.isPending}>
                                <Check className="h-3 w-3 mr-1" /> Complete
                              </Button>
                            )}
                            {b.status === "completed" && b.ownerPayoutStatus === "pending" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => payoutMutation.mutate(b.id)} disabled={payoutMutation.isPending}>
                                <Banknote className="h-3 w-3 mr-1" /> Payout
                              </Button>
                            )}
                            {["checked_out", "completed"].includes(b.status) && b.securityDepositAmount && !["returned", "partially_returned", "forfeited"].includes(b.depositStatus || "") && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDepositBookingId(b.id); setDepositDialogOpen(true); }}>
                                <RefreshCw className="h-3 w-3 mr-1" /> Deposit
                              </Button>
                            )}
                            {b.depositStatus && ["returned", "partially_returned", "forfeited"].includes(b.depositStatus) && (
                              <span className="text-[10px] text-green-600">Deposit done</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Calendar View */}
      {view === "calendar" && (
        <BookingCalendarView
          bookings={calendarData?.bookings ?? bookings}
          blocked={calendarData?.blocked ?? []}
        />
      )}

      {/* ─── Manual Booking Dialog ─── */}
      <Dialog open={manualBookingOpen} onOpenChange={setManualBookingOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Manual Booking</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Guest Name *</Label>
                <Input value={mbForm.guestName} onChange={e => setMbForm(f => ({ ...f, guestName: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={mbForm.guestEmail} onChange={e => setMbForm(f => ({ ...f, guestEmail: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={mbForm.guestPhone} onChange={e => setMbForm(f => ({ ...f, guestPhone: e.target.value }))} />
              </div>
              <div>
                <Label>Guests</Label>
                <Input type="number" min="1" value={mbForm.guests} onChange={e => setMbForm(f => ({ ...f, guests: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Check-in *</Label>
                <Input type="date" value={mbForm.checkIn} onChange={e => setMbForm(f => ({ ...f, checkIn: e.target.value }))} />
              </div>
              <div>
                <Label>Check-out *</Label>
                <Input type="date" value={mbForm.checkOut} onChange={e => setMbForm(f => ({ ...f, checkOut: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source</Label>
                <Select value={mbForm.source} onValueChange={v => setMbForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Direct / Website</SelectItem>
                    <SelectItem value="airbnb">Airbnb</SelectItem>
                    <SelectItem value="booking_com">Booking.com</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>External Ref</Label>
                <Input value={mbForm.externalRef} onChange={e => setMbForm(f => ({ ...f, externalRef: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Payment Method</Label>
              <Input value={mbForm.paymentMethod} onChange={e => setMbForm(f => ({ ...f, paymentMethod: e.target.value }))} placeholder="e.g. cash, bank transfer" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={mbForm.notes} onChange={e => setMbForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <Button
              onClick={() => manualBookingMutation.mutate({
                propertyId: property.id,
                guestName: mbForm.guestName,
                guestEmail: mbForm.guestEmail || undefined,
                guestPhone: mbForm.guestPhone || undefined,
                checkIn: mbForm.checkIn,
                checkOut: mbForm.checkOut,
                guests: parseInt(mbForm.guests) || 1,
                source: mbForm.source,
                externalRef: mbForm.externalRef || undefined,
                paymentMethod: mbForm.paymentMethod || undefined,
                notes: mbForm.notes || undefined,
              })}
              disabled={!mbForm.guestName || !mbForm.checkIn || !mbForm.checkOut || manualBookingMutation.isPending}
            >
              {manualBookingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Block Dates Dialog ─── */}
      <Dialog open={blockDatesOpen} onOpenChange={setBlockDatesOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Block Dates</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={bdForm.startDate} onChange={e => setBdForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <Label>End Date *</Label>
              <Input type="date" value={bdForm.endDate} onChange={e => setBdForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={bdForm.reason} onChange={e => setBdForm(f => ({ ...f, reason: e.target.value }))} rows={2} />
            </div>
            <Button
              onClick={() => blockDatesMutation.mutate({ propertyId: property.id, startDate: bdForm.startDate, endDate: bdForm.endDate, reason: bdForm.reason || undefined })}
              disabled={!bdForm.startDate || !bdForm.endDate || blockDatesMutation.isPending}
            >
              {blockDatesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Block Dates
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Decline Dialog ─── */}
      <Dialog open={declineDialogOpen} onOpenChange={v => { setDeclineDialogOpen(v); if (!v) setDeclineReason(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Decline Booking</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Reason *</Label>
              <Textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} placeholder="Reason for declining..." />
            </div>
            <Button
              variant="destructive"
              onClick={() => declineBookingId && declineMutation.mutate({ id: declineBookingId, reason: declineReason })}
              disabled={!declineReason || declineMutation.isPending}
            >
              {declineMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Decline Booking
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Check-out Dialog ─── */}
      <Dialog open={checkoutDialogOpen} onOpenChange={v => { setCheckoutDialogOpen(v); if (!v) setCoForm({ condition: "good", damageNotes: "", damagePhotos: "", checklist: DEFAULT_CHECKOUT_CHECKLIST }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Check Out Guest</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">

            {/* Checkout Checklist */}
            <div>
              <p className="text-sm font-medium mb-2">Checkout Checklist</p>
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                {coForm.checklist.map((item, i) => (
                  <label key={i} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => setCoForm(f => ({
                        ...f,
                        checklist: f.checklist.map((c, j) => j === i ? { ...c, completed: !c.completed } : c),
                      }))}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                    <span className={item.completed ? "line-through text-muted-foreground" : ""}>{item.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {coForm.checklist.filter(c => c.completed).length} / {coForm.checklist.length} completed
              </p>
            </div>

            <Separator />

            {/* Condition */}
            <div>
              <Label>Property Condition *</Label>
              <Select value={coForm.condition} onValueChange={v => setCoForm(f => ({ ...f, condition: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Damage notes — shown when condition isn't good */}
            {coForm.condition !== "good" && (
              <div>
                <Label>Damage Notes</Label>
                <Textarea value={coForm.damageNotes} onChange={e => setCoForm(f => ({ ...f, damageNotes: e.target.value }))} rows={3} placeholder="Describe any damages..." />
              </div>
            )}

            <Button
              onClick={() => checkoutBookingId && checkOutMutation.mutate({
                id: checkoutBookingId,
                checklistItems: coForm.checklist,
                damageAssessment: { condition: coForm.condition, notes: coForm.damageNotes },
              })}
              disabled={checkOutMutation.isPending}
            >
              {checkOutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Check Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Deposit Return Dialog ─── */}
      <Dialog open={depositDialogOpen} onOpenChange={v => { setDepositDialogOpen(v); if (!v) setDepForm({ returnType: "full", deductions: [] }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Return Deposit</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Return Type</Label>
              <Select value={depForm.returnType} onValueChange={v => setDepForm(f => ({ ...f, returnType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Return</SelectItem>
                  <SelectItem value="partial">Partial (with deductions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {depForm.returnType === "partial" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Deductions</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDepForm(f => ({ ...f, deductions: [...f.deductions, { reason: "", amount: "" }] }))}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {depForm.deductions.map((d, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input placeholder="Reason" value={d.reason} onChange={e => {
                        const ded = [...depForm.deductions];
                        ded[i] = { ...ded[i], reason: e.target.value };
                        setDepForm(f => ({ ...f, deductions: ded }));
                      }} />
                    </div>
                    <div className="w-24">
                      <Input type="number" placeholder="Amount" value={d.amount} onChange={e => {
                        const ded = [...depForm.deductions];
                        ded[i] = { ...ded[i], amount: e.target.value };
                        setDepForm(f => ({ ...f, deductions: ded }));
                      }} />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setDepForm(f => ({ ...f, deductions: f.deductions.filter((_, j) => j !== i) }))}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              onClick={() => depositBookingId && depositReturnMutation.mutate({
                id: depositBookingId,
                returnType: depForm.returnType,
                deductions: depForm.deductions.map(d => ({ reason: d.reason, amount: parseFloat(d.amount) || 0 })),
              })}
              disabled={depositReturnMutation.isPending || (depForm.returnType === "partial" && depForm.deductions.length === 0)}
            >
              {depositReturnMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Return Deposit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Booking Detail Dialog ─── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Booking Details</DialogTitle></DialogHeader>
          {detailBooking && (
            <div className="space-y-5 py-2 text-sm">

              {/* Booking info */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status</span>
                  <BookingStatusBadge status={detailBooking.status} />
                </div>
                {[
                  { label: "Guest Name", value: detailBooking.guestName, icon: Users },
                  { label: "Email", value: detailBooking.guestEmail, icon: Mail },
                  { label: "Check-in", value: detailBooking.checkInDate ? bookingFormatDate(detailBooking.checkInDate) : null, icon: LogIn },
                  { label: "Check-out", value: detailBooking.checkOutDate ? bookingFormatDate(detailBooking.checkOutDate) : null, icon: LogOut },
                  { label: "Nights", value: detailBooking.totalNights, icon: CalendarDays },
                  { label: "Guests", value: detailBooking.numberOfGuests, icon: Users },
                  { label: "Total Amount", value: bookingFormatCurrency(detailBooking.totalAmount), icon: DollarSign },
                  { label: "Payment Method", value: detailBooking.paymentMethod, icon: CreditCard },
                  { label: "Payment Status", value: detailBooking.paymentStatus, icon: CreditCard },
                  { label: "Source", value: detailBooking.source?.replace("_", "."), icon: ExternalLink },
                  { label: "External Ref", value: detailBooking.externalBookingRef, icon: Hash },
                  { label: "Access PIN", value: detailBooking.accessPin, icon: ShieldCheck },
                  { label: "Owner Payout", value: detailBooking.ownerPayoutStatus, icon: Banknote },
                  { label: "Commission", value: bookingFormatCurrency(detailBooking.commissionAmount), icon: Percent },
                  { label: "Created", value: detailBooking.createdAt ? bookingFormatDate(detailBooking.createdAt) : null, icon: Clock },
                ].filter(r => r.value != null && r.value !== "" && r.value !== "—").map(r => (
                  <div key={r.label} className="flex items-center justify-between py-1 border-b last:border-0">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <r.icon className="h-3.5 w-3.5" /> {r.label}
                    </span>
                    <span className="font-medium capitalize">{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Guest KYC / Documents */}
              {fullDetailBooking?.guestProfile && (() => {
                const gp = fullDetailBooking.guestProfile;
                return (
                  <div className="space-y-3 pt-2 border-t">
                    <p className="font-semibold text-sm">Guest Identity</p>
                    {[
                      { label: "Nationality", value: gp.nationality },
                      { label: "Date of Birth", value: gp.dob },
                      { label: "Passport No.", value: gp.passportNumber },
                      { label: "Passport Expiry", value: gp.passportExpiry },
                      { label: "Emirates ID", value: gp.emiratesIdNumber },
                      { label: "Emirates ID Expiry", value: gp.emiratesIdExpiry },
                      { label: "KYC Status", value: gp.kycStatus },
                    ].filter(r => r.value).map(r => (
                      <div key={r.label} className="flex items-center justify-between py-1 border-b last:border-0">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className="font-medium capitalize">{r.value}</span>
                      </div>
                    ))}

                    {/* Document images */}
                    {(gp.passportFrontUrl || gp.emiratesIdFrontUrl || gp.emiratesIdBackUrl) && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document Copies</p>
                        <div className="grid grid-cols-3 gap-2">
                          {gp.passportFrontUrl && (
                            <a href={gp.passportFrontUrl} target="_blank" rel="noopener noreferrer" className="group">
                              <div className="rounded-md border overflow-hidden bg-muted aspect-[3/2]">
                                <img src={gp.passportFrontUrl} alt="Passport" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                              </div>
                              <p className="text-[10px] text-center text-muted-foreground mt-1">Passport</p>
                            </a>
                          )}
                          {gp.emiratesIdFrontUrl && (
                            <a href={gp.emiratesIdFrontUrl} target="_blank" rel="noopener noreferrer" className="group">
                              <div className="rounded-md border overflow-hidden bg-muted aspect-[3/2]">
                                <img src={gp.emiratesIdFrontUrl} alt="Emirates ID Front" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                              </div>
                              <p className="text-[10px] text-center text-muted-foreground mt-1">EID Front</p>
                            </a>
                          )}
                          {gp.emiratesIdBackUrl && (
                            <a href={gp.emiratesIdBackUrl} target="_blank" rel="noopener noreferrer" className="group">
                              <div className="rounded-md border overflow-hidden bg-muted aspect-[3/2]">
                                <img src={gp.emiratesIdBackUrl} alt="Emirates ID Back" className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                              </div>
                              <p className="text-[10px] text-center text-muted-foreground mt-1">EID Back</p>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Transactions ───────────────────────────────────────────────────────

function ViewTransactions({ property }: { property: StPropertyData }) {
  const { hasPermission } = useAuth();
  const canManageFinancials = hasPermission("financials.manage");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<any>(null);

  const { data: expenses } = useQuery<any[]>({
    queryKey: [`/st-properties/${property.id}/expenses`],
    queryFn: () => api.get(`/st-properties/${property.id}/expenses`),
  });

  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) => api.delete(`/st-properties/${property.id}/expenses/${expenseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/expenses`] });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/investment-summary`] });
    },
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Transactions</h3>
        </div>
        {canManageFinancials && (
          <Button size="sm" onClick={() => { setEditExpense(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Expense
          </Button>
        )}
      </div>
      <Separator className="mb-6" />

      {/* Full Transaction History */}
      <TransactionHistory propertyId={property.id} />

      <Separator className="my-6" />

      <h4 className="text-sm font-semibold mb-3">Manual Expenses</h4>

      {!expenses || expenses.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <Receipt className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No manual expenses recorded yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Responsible</th>
                <th className="px-4 py-2 font-medium">Paid By</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
                <th className="px-4 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp: any) => {
                const catLabel = EXPENSE_CATEGORIES.find((c) => c.value === exp.category)?.label || exp.category;
                const payStatusColor = exp.paymentStatus === "paid" ? "bg-green-100 text-green-800" : exp.paymentStatus === "partial" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800";
                return (
                  <tr key={exp.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateShort(exp.expenseDate)}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={cn("text-[11px]", CATEGORY_COLORS[exp.category] || "bg-gray-100 text-gray-700")}>
                        {catLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="truncate max-w-[160px]">{exp.description || "—"}</p>
                      {exp.billImageUrl && <a href={exp.billImageUrl} target="_blank" rel="noopener" className="text-xs text-primary hover:underline">View bill</a>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{exp.responsibleParty?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{exp.paidBy?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={`text-[10px] border-0 ${payStatusColor}`}>{exp.paymentStatus || "unpaid"}</Badge>
                      {exp.paymentProofUrl && <a href={exp.paymentProofUrl} target="_blank" rel="noopener" className="text-xs text-primary hover:underline block mt-0.5">Proof</a>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-2.5">
                      {canManageFinancials && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => { setEditExpense(exp); setDialogOpen(true); }}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (confirm("Delete this expense?")) {
                                deleteMutation.mutate(exp.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Expense Dialog */}
      {dialogOpen && (
        <ExpenseDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditExpense(null); }}
          propertyId={property.id}
          editExpense={editExpense}
        />
      )}
    </div>
  );
}

// ─── Tab: Activity Log ───────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  property_created: { label: "Created", color: "bg-green-100 text-green-700" },
  property_updated: { label: "Updated", color: "bg-blue-100 text-blue-700" },
  property_activated: { label: "Activated", color: "bg-green-100 text-green-700" },
  property_deactivated: { label: "Deactivated", color: "bg-gray-100 text-gray-700" },
  status_changed: { label: "Status", color: "bg-yellow-100 text-yellow-700" },
  photo_added: { label: "Photo Added", color: "bg-purple-100 text-purple-700" },
  photo_removed: { label: "Photo Removed", color: "bg-red-100 text-red-700" },
  document_added: { label: "Document Added", color: "bg-cyan-100 text-cyan-700" },
  document_removed: { label: "Document Removed", color: "bg-red-100 text-red-700" },
  expense_added: { label: "Expense Added", color: "bg-orange-100 text-orange-700" },
  expense_updated: { label: "Expense Updated", color: "bg-amber-100 text-amber-700" },
  expense_deleted: { label: "Expense Deleted", color: "bg-red-100 text-red-700" },
  owner_assigned: { label: "Owner Assigned", color: "bg-indigo-100 text-indigo-700" },
  owner_removed: { label: "Owner Removed", color: "bg-red-100 text-red-700" },
  agreement_confirmed: { label: "Agreement", color: "bg-green-100 text-green-700" },
  acquisition_updated: { label: "Acquisition", color: "bg-blue-100 text-blue-700" },
  amenities_updated: { label: "Amenities", color: "bg-pink-100 text-pink-700" },
  policies_updated: { label: "Policies", color: "bg-teal-100 text-teal-700" },
  pricing_updated: { label: "Pricing", color: "bg-emerald-100 text-emerald-700" },
  description_updated: { label: "Description", color: "bg-blue-100 text-blue-700" },
  details_updated: { label: "Details", color: "bg-slate-100 text-slate-700" },
};

function formatActivityTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Tab: Calendar & Pricing ──────────────────────────────────────────────

function ViewCalendarPricing({ property }: { property: StPropertyData }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ price: "", weekdayPrice: "", weekendPrice: "", minStay: "", notes: "" });
  const [singleEdit, setSingleEdit] = useState<{ date: string; price: string; minStay: string } | null>(null);

  const startDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-01`;
  const endD = new Date(currentMonth.year, currentMonth.month + 1, 0);
  const endDate = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;

  const { data } = useQuery<any>({
    queryKey: [`/st-properties/${property.id}/calendar-pricing`, startDate, endDate],
    queryFn: () => api.get(`/st-properties/${property.id}/calendar-pricing?from=${startDate}&to=${endDate}`),
  });

  const bulkMut = useMutation({
    mutationFn: () => {
      const body: any = { startDate: selectedDates[0], endDate: selectedDates[selectedDates.length - 1] };
      if (bulkForm.price) body.price = bulkForm.price;
      if (bulkForm.weekdayPrice) body.weekdayPrice = bulkForm.weekdayPrice;
      if (bulkForm.weekendPrice) body.weekendPrice = bulkForm.weekendPrice;
      if (bulkForm.minStay) body.minStay = parseInt(bulkForm.minStay);
      if (bulkForm.notes) body.notes = bulkForm.notes;
      return api.put(`/st-properties/${property.id}/pricing`, body);
    },
    onSuccess: () => {
      toast({ title: "Pricing updated" });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/calendar-pricing`] });
      setBulkOpen(false); setSelectedDates([]); setBulkForm({ price: "", weekdayPrice: "", weekendPrice: "", minStay: "", notes: "" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const singleMut = useMutation({
    mutationFn: () => api.patch(`/st-properties/${property.id}/pricing/${singleEdit!.date}`, {
      price: singleEdit!.price, minStay: singleEdit!.minStay ? parseInt(singleEdit!.minStay) : null,
    }),
    onSuccess: () => {
      toast({ title: "Price updated" });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/calendar-pricing`] });
      setSingleEdit(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const resetMut = useMutation({
    mutationFn: () => api.delete(`/st-properties/${property.id}/pricing`, { data: { startDate: selectedDates[0], endDate: selectedDates[selectedDates.length - 1] } }),
    onSuccess: () => {
      toast({ title: "Pricing reset to defaults" });
      queryClient.invalidateQueries({ queryKey: [`/st-properties/${property.id}/calendar-pricing`] });
      setSelectedDates([]);
    },
  });

  // Build calendar grid
  const defaults = data?.defaults || {};
  const defaultNightly = parseFloat(defaults.nightlyRate || "0");
  const defaultWeekend = parseFloat(defaults.weekendRate || defaults.nightlyRate || "0");

  const pricingMap = new Map<string, any>();
  (data?.pricing || []).forEach((p: any) => {
    const d = typeof p.date === "string" ? p.date.slice(0, 10) : fmtDate(new Date(p.date));
    pricingMap.set(d, p);
  });

  // Helper to format date without timezone issues
  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const bookingMap = new Map<string, any>();
  (data?.bookings || []).forEach((b: any) => {
    const startStr = typeof b.checkIn === "string" ? b.checkIn.slice(0, 10) : b.checkIn;
    const endStr = typeof b.checkOut === "string" ? b.checkOut.slice(0, 10) : b.checkOut;
    const start = new Date(startStr + "T12:00:00");
    const end = new Date(endStr + "T12:00:00");
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      bookingMap.set(fmtDate(d), b);
    }
  });

  const blockedSet = new Set<string>();
  (data?.blocked || []).forEach((bl: any) => {
    const startStr = typeof bl.startDate === "string" ? bl.startDate.slice(0, 10) : bl.startDate;
    const endStr = typeof bl.endDate === "string" ? bl.endDate.slice(0, 10) : bl.endDate;
    const start = new Date(startStr + "T12:00:00");
    const end = new Date(endStr + "T12:00:00");
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      blockedSet.add(fmtDate(d));
    }
  });

  const firstDay = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const today = fmtDate(new Date());

  const prevMonth = () => setCurrentMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 });
  const nextMonth = () => setCurrentMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 });

  const toggleDate = (dateStr: string) => {
    setSelectedDates(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort());
  };

  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Calendar & Pricing</h3>
        </div>
        <div className="flex items-center gap-2">
          {selectedDates.length > 0 && (
            <>
              <Badge variant="secondary">{selectedDates.length} selected</Badge>
              <Button size="sm" onClick={() => setBulkOpen(true)}>Set Pricing</Button>
              <Button size="sm" variant="outline" onClick={() => resetMut.mutate()}>Reset to Default</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedDates([])}>Clear</Button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" /> Booked</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Blocked</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Custom Price</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/20 border border-primary" /> Selected</span>
        <span className="text-muted-foreground ml-2">Default: AED {defaultNightly} weekday / AED {defaultWeekend} weekend</span>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="outline" size="sm" onClick={prevMonth}>← Prev</Button>
        <h4 className="text-base font-semibold">{monthName}</h4>
        <Button variant="outline" size="sm" onClick={nextMonth}>Next →</Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
        ))}
        {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} className="min-h-[80px]" />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayOfWeek = new Date(currentMonth.year, currentMonth.month, day).getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sat (6), Sun (0)
          const booking = bookingMap.get(dateStr);
          const isBlocked = blockedSet.has(dateStr);
          const customPrice = pricingMap.get(dateStr);
          const isSelected = selectedDates.includes(dateStr);
          const isPast = dateStr < today;

          const price = customPrice ? parseFloat(customPrice.price) : (isWeekend ? defaultWeekend : defaultNightly);
          const isCustom = !!customPrice;

          let bg = "bg-green-50 border-green-200 hover:bg-green-100";
          if (booking) bg = "bg-blue-50 border-blue-200";
          if (isBlocked) bg = "bg-red-50 border-red-200";
          if (isCustom && !booking && !isBlocked) bg = "bg-amber-50 border-amber-200";
          if (isSelected) bg = "bg-primary/10 border-primary ring-1 ring-primary";
          if (isPast) bg = "bg-gray-50 border-gray-200 opacity-50";

          const statusMap: Record<string, string> = { requested: "REQ", confirmed: "CNF", checked_in: "IN", checked_out: "OUT", completed: "DONE" };

          return (
            <div
              key={dateStr}
              className={`min-h-[80px] border rounded-md p-1.5 cursor-pointer transition-colors text-xs ${bg}`}
              onClick={() => {
                if (isPast) return;
                if (booking || isBlocked) return;
                toggleDate(dateStr);
              }}
              onDoubleClick={() => {
                if (isPast || booking || isBlocked) return;
                setSingleEdit({ date: dateStr, price: String(price), minStay: customPrice?.minStay?.toString() || "" });
              }}
            >
              <div className="flex justify-between items-start">
                <span className={`font-semibold ${dateStr === today ? "text-primary" : ""}`}>{day}</span>
                {isWeekend && <span className="text-[9px] text-muted-foreground">WE</span>}
              </div>
              <p className={`font-bold mt-0.5 ${isCustom ? "text-amber-700" : "text-gray-700"}`}>
                {price > 0 ? `${price}` : "—"}
              </p>
              {booking && (
                <div className="mt-0.5">
                  <p className="truncate text-[10px] text-blue-700 font-medium">{booking.guestName}</p>
                  <Badge className="text-[8px] h-3.5 bg-blue-100 text-blue-800 border-0">{statusMap[booking.status] || booking.status}</Badge>
                </div>
              )}
              {isBlocked && <p className="text-[10px] text-red-600 mt-0.5">Blocked</p>}
              {customPrice?.minStay && <p className="text-[9px] text-muted-foreground">Min {customPrice.minStay}n</p>}
            </div>
          );
        })}
      </div>

      {/* Bulk Pricing Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Set Pricing — {selectedDates.length} days</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{selectedDates[0]} to {selectedDates[selectedDates.length - 1]}</p>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Flat Price (AED) — applies to all days</Label>
              <Input type="number" value={bulkForm.price} onChange={e => setBulkForm(f => ({ ...f, price: e.target.value, weekdayPrice: "", weekendPrice: "" }))} placeholder="e.g. 1500" />
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">Or set different weekday/weekend prices:</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Weekday Price</Label>
                <Input type="number" value={bulkForm.weekdayPrice} onChange={e => setBulkForm(f => ({ ...f, weekdayPrice: e.target.value, price: "" }))} placeholder="Sun-Thu" />
              </div>
              <div className="space-y-1.5">
                <Label>Weekend Price</Label>
                <Input type="number" value={bulkForm.weekendPrice} onChange={e => setBulkForm(f => ({ ...f, weekendPrice: e.target.value, price: "" }))} placeholder="Fri-Sat" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Minimum Stay (nights)</Label>
              <Input type="number" value={bulkForm.minStay} onChange={e => setBulkForm(f => ({ ...f, minStay: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={bulkForm.notes} onChange={e => setBulkForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Peak season, Eid holiday" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button disabled={bulkMut.isPending || (!bulkForm.price && !bulkForm.weekdayPrice)} onClick={() => bulkMut.mutate()}>
              {bulkMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Apply Pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Date Edit Dialog */}
      <Dialog open={!!singleEdit} onOpenChange={(o) => !o && setSingleEdit(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Price — {singleEdit?.date}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Price (AED)</Label>
              <Input type="number" value={singleEdit?.price || ""} onChange={e => setSingleEdit(prev => prev ? { ...prev, price: e.target.value } : null)} />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stay (nights)</Label>
              <Input type="number" value={singleEdit?.minStay || ""} onChange={e => setSingleEdit(prev => prev ? { ...prev, minStay: e.target.value } : null)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSingleEdit(null)}>Cancel</Button>
            <Button disabled={singleMut.isPending || !singleEdit?.price} onClick={() => singleMut.mutate()}>
              {singleMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Reviews ──────────────────────────────────────────────────────────

function ViewReviews({ property }: { property: StPropertyData }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  const { data, isLoading } = useQuery<{ reviews: any[]; total: number; avgRating: string }>({
    queryKey: [`/public/properties/${property.id}/reviews`],
    queryFn: () => api.get(`/public/properties/${property.id}/reviews?limit=50`),
  });

  const responseMut = useMutation({
    mutationFn: ({ bookingId, response }: { bookingId: string; response: string }) =>
      api.patch(`/bookings/${bookingId}/review/response`, { response }),
    onSuccess: () => {
      toast({ title: "Response saved" });
      queryClient.invalidateQueries({ queryKey: [`/public/properties/${property.id}/reviews`] });
      setRespondingId(null);
      setResponseText("");
    },
    onError: (e: any) => toast({ title: e.message || "Failed to save", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const reviews = data?.reviews || [];
  const avg = parseFloat(data?.avgRating || "0");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <Star className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Guest Reviews</h3>
      </div>
      <Separator className="mb-6" />

      {/* Summary */}
      <div className="flex items-center gap-6 mb-6">
        <div className="text-center">
          <p className="text-4xl font-bold">{avg > 0 ? avg.toFixed(1) : "—"}</p>
          <div className="flex gap-0.5 mt-1 justify-center">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className={`h-4 w-4 ${i <= Math.round(avg) ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{data?.total || 0} review(s)</p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Star className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No reviews yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} className={`h-4 w-4 ${i <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                      ))}
                    </div>
                    {r.title && <p className="font-semibold">{r.title}</p>}
                    {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <p>{r.guestName || "Guest"}</p>
                    <p>{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}</p>
                  </div>
                </div>
                {r.pmResponse ? (
                  <div className="mt-3 bg-muted/50 rounded p-3 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">PM Response</p>
                    <p>{r.pmResponse}</p>
                  </div>
                ) : (
                  <div className="mt-3">
                    {respondingId === r.bookingId ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Write your response..."
                          value={responseText}
                          onChange={e => setResponseText(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={!responseText.trim() || responseMut.isPending}
                            onClick={() => responseMut.mutate({ bookingId: r.bookingId, response: responseText })}
                          >
                            {responseMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Save Response
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setRespondingId(null); setResponseText(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setRespondingId(r.bookingId)}>
                        Respond to Review
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Activity Log ──────────────────────────────────────────────────────

function ViewActivity({ property }: { property: StPropertyData }) {
  const { data: activities } = useQuery<any[]>({
    queryKey: [`/st-properties/${property.id}/activity`],
    queryFn: () => api.get(`/st-properties/${property.id}/activity`),
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Activity Log</h3>
      </div>
      <Separator className="mb-6" />

      {!activities || activities.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-muted-foreground mb-1">No Activity Recorded</h4>
          <p className="text-sm text-muted-foreground">
            Changes, status updates, and activity history for this property will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {activities.map((act: any, i: number) => {
            const actionInfo = ACTION_LABELS[act.action] || { label: act.action, color: "bg-gray-100 text-gray-700" };
            return (
              <div key={act.id} className="flex gap-4 py-3 border-b last:border-b-0">
                {/* Timeline dot */}
                <div className="flex flex-col items-center pt-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                  {i < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-[10px] font-medium", actionInfo.color)}>
                      {actionInfo.label}
                    </Badge>
                    <span className="text-sm">{act.description}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{act.userName || "System"}</span>
                    <span>•</span>
                    <span>{formatActivityTime(act.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
