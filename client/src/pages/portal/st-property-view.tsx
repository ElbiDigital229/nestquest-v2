import { useState, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

const TABS = [
  { key: "details", name: "Property Details", icon: Home },
  { key: "description", name: "Description", icon: FileText },
  { key: "photos", name: "Photos", icon: Camera },
  { key: "amenities", name: "Amenities", icon: Sparkles },
  { key: "pricing", name: "Pricing", icon: DollarSign },
  { key: "policies", name: "Policies", icon: ShieldCheck },
  { key: "owner", name: "Property Owner", icon: Users },
  { key: "agreement", name: "Agreement", icon: ClipboardCheck },
  { key: "investment", name: "Investment", icon: TrendingUp },
  { key: "bookings", name: "Bookings", icon: CalendarDays },
  { key: "transactions", name: "Transactions", icon: Receipt },
  { key: "activity", name: "Activity Log", icon: Activity },
] as const;

type TabKey = (typeof TABS)[number]["key"];

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
  const [, navigate] = useLocation();
  const id = propId || params?.id;

  const [activeTab, setActiveTab] = useState<TabKey>("details");

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
        <Button
          size="sm"
          onClick={() => navigate(`/portal/st-properties/${id}/edit`)}
        >
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit Property
        </Button>
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
                  onClick={() => setActiveTab(tab.key)}
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
          {activeTab === "investment" && <ViewInvestment property={property} />}
          {activeTab === "bookings" && <ViewBookings property={property} />}
          {activeTab === "transactions" && <ViewTransactions property={property} />}
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
  });

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
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Category *</Label>
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
            <Label>Amount (AED) *</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of the expense..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!form.category || !form.amount || !form.expenseDate || mutation.isPending}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
        <div className="rounded-lg border p-4 bg-orange-50/50">
          <p className="text-xs text-muted-foreground mb-1">Additional Expenses</p>
          <p className="text-xl font-bold text-orange-700">{formatCurrency(summary?.totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-1">{summary?.expenseCount || 0} expense(s)</p>
        </div>
        <div className="rounded-lg border p-4 bg-green-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Investment</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(summary?.totalInvestment)}</p>
          <p className="text-xs text-muted-foreground mt-1">Asset value to date</p>
        </div>
      </div>

      {/* Income Cards */}
      <h4 className="text-sm font-semibold mb-3">Revenue</h4>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border p-4 bg-emerald-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Income</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(summary?.totalIncome)}</p>
          <p className="text-xs text-muted-foreground mt-1">{summary?.bookingCount || 0} booking(s)</p>
        </div>
        <div className="rounded-lg border p-4 bg-purple-50/50">
          <p className="text-xs text-muted-foreground mb-1">PM Commission</p>
          <p className="text-xl font-bold text-purple-700">{formatCurrency(summary?.totalCommission)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-cyan-50/50">
          <p className="text-xs text-muted-foreground mb-1">Owner Payout</p>
          <p className="text-xl font-bold text-cyan-700">{formatCurrency(summary?.totalOwnerPayout)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${parseFloat(summary?.netProfit || "0") >= 0 ? "bg-green-50/50" : "bg-red-50/50"}`}>
          <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
          <p className={`text-xl font-bold ${parseFloat(summary?.netProfit || "0") >= 0 ? "text-green-700" : "text-red-700"}`}>
            {formatCurrency(summary?.netProfit)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Income - Expenses</p>
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
  const [coForm, setCoForm] = useState({ condition: "good", damageNotes: "", damagePhotos: "" });

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
    mutationFn: ({ id, ...body }: { id: string; condition: string; damageNotes: string; damagePhotos: string }) =>
      api.patch(`/bookings/${id}/check-out`, body),
    onSuccess: () => {
      invalidate(); setCheckoutDialogOpen(false);
      setCoForm({ condition: "good", damageNotes: "", damagePhotos: "" });
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
        <Button size="sm" onClick={() => setManualBookingOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Booking
        </Button>
        <Button size="sm" variant="outline" onClick={() => setBlockDatesOpen(true)}>
          <Ban className="h-4 w-4 mr-1" /> Block Dates
        </Button>
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
                        onClick={() => { setDetailBooking(b); setDetailDialogOpen(true); }}
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
                            {b.status === "completed" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setDepositBookingId(b.id); setDepositDialogOpen(true); }}>
                                <RefreshCw className="h-3 w-3 mr-1" /> Deposit
                              </Button>
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
      <Dialog open={checkoutDialogOpen} onOpenChange={v => { setCheckoutDialogOpen(v); if (!v) setCoForm({ condition: "good", damageNotes: "", damagePhotos: "" }); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Check Out Guest</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
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
            <div>
              <Label>Damage Notes</Label>
              <Textarea value={coForm.damageNotes} onChange={e => setCoForm(f => ({ ...f, damageNotes: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label>Damage Photos (URLs, comma-separated)</Label>
              <Input value={coForm.damagePhotos} onChange={e => setCoForm(f => ({ ...f, damagePhotos: e.target.value }))} />
            </div>
            <Button
              onClick={() => checkoutBookingId && checkOutMutation.mutate({
                id: checkoutBookingId,
                condition: coForm.condition,
                damageNotes: coForm.damageNotes,
                damagePhotos: coForm.damagePhotos,
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
            <div className="grid gap-3 py-2 text-sm">
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Transactions ───────────────────────────────────────────────────────

function ViewTransactions({ property }: { property: StPropertyData }) {
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
        <Button size="sm" onClick={() => { setEditExpense(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Expense
        </Button>
      </div>
      <Separator className="mb-6" />

      {!expenses || expenses.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-muted-foreground mb-1">No Transactions Yet</h4>
          <p className="text-sm text-muted-foreground">
            Add expenses to track costs for this property.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
                <th className="px-4 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp: any) => {
                const catLabel = EXPENSE_CATEGORIES.find((c) => c.value === exp.category)?.label || exp.category;
                return (
                  <tr key={exp.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateShort(exp.expenseDate)}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={cn("text-[11px]", CATEGORY_COLORS[exp.category] || "bg-gray-100 text-gray-700")}>
                        {catLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 truncate max-w-[200px]">{exp.description || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-2.5">
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
