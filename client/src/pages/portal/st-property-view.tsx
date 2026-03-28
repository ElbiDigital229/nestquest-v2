import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";

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

// ─── Tab: Bookings (Placeholder) ────────────────────────────────────────────

function ViewBookings({ property }: { property: StPropertyData }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Bookings</h3>
      </div>
      <Separator className="mb-6" />
      <div className="text-center py-16">
        <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-muted-foreground mb-1">No Bookings Yet</h4>
        <p className="text-sm text-muted-foreground">
          Bookings for this property will appear here once guests start booking.
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Transactions (Placeholder) ────────────────────────────────────────

function ViewTransactions({ property }: { property: StPropertyData }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <Receipt className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Transactions</h3>
      </div>
      <Separator className="mb-6" />
      <div className="text-center py-16">
        <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-muted-foreground mb-1">No Transactions Yet</h4>
        <p className="text-sm text-muted-foreground">
          Financial transactions related to this property will appear here.
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Activity Log (Placeholder) ────────────────────────────────────────

function ViewActivity({ property }: { property: StPropertyData }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Activity Log</h3>
      </div>
      <Separator className="mb-6" />
      <div className="text-center py-16">
        <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-muted-foreground mb-1">No Activity Recorded</h4>
        <p className="text-sm text-muted-foreground">
          Changes, status updates, and activity history for this property will appear here.
        </p>
      </div>
    </div>
  );
}
