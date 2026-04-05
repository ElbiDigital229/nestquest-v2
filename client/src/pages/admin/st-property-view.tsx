import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  ArrowLeft,
  Home,
  FileText,
  Camera,
  Sparkles,
  DollarSign,
  ShieldCheck,
  Users,
  ClipboardCheck,
  MapPin,
  Building2,
  CreditCard,
  Clock,
  Droplets,
  Percent,
  Check,
  X,
  ExternalLink,
  Package,
  TrendingUp,
  CalendarDays,
  Receipt,
  Star,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const statusBadge: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  active: { label: "Active", className: "bg-green-600 text-white" },
  inactive: { label: "Inactive", className: "bg-gray-200 text-gray-600" },
};

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi", air_conditioning: "Air Conditioning", tv: "TV", iron: "Iron",
  hair_dryer: "Hair Dryer", swimming_pool: "Swimming Pool", gym: "Gym / Fitness Center",
  workspace: "Workspace / Desk", elevator: "Elevator", free_parking: "Free Parking",
  concierge: "Concierge", doorman: "Doorman", storage_room: "Storage Room",
  central_gas: "Central Gas", "24_7_security": "24/7 Security", cctv: "CCTV",
  intercom: "Intercom", beach_access: "Beach Access", bbq_area: "BBQ Area",
  garden: "Garden", kids_play_area: "Kids Play Area", kitchen: "Kitchen",
  coffee_machine: "Coffee Machine", dishwasher: "Dishwasher", microwave: "Microwave",
  oven: "Oven", washer: "Washer", dryer: "Dryer", pets_allowed: "Pets Allowed",
  smoking_area: "Smoking Area", housekeeping_available: "Housekeeping Available",
};

const CANCELLATION_LABELS: Record<string, string> = {
  flexible: "Flexible — Full refund up to 24 hours before check-in",
  moderate: "Moderate — Full refund up to 5 days before check-in",
  strict: "Strict — 50% refund up to 7 days before check-in",
  non_refundable: "Non-Refundable — No refund after booking",
};

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
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch { /* ignore */ }
  }
  return [];
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: "details", name: "Property Details", icon: Home },
  { key: "description", name: "Description", icon: FileText },
  { key: "photos", name: "Photos", icon: Camera },
  { key: "amenities", name: "Amenities", icon: Sparkles },
  { key: "pricing", name: "Pricing", icon: DollarSign },
  { key: "policies", name: "Policies", icon: ShieldCheck },
  { key: "owner", name: "Property Owner", icon: Users },
  { key: "agreement", name: "Agreement", icon: ClipboardCheck },
  { key: "inventory", name: "Inventory", icon: Package },
  { key: "investment", name: "Investment", icon: TrendingUp },
  { key: "calendar", name: "Calendar", icon: CalendarDays },
  { key: "bookings", name: "Bookings", icon: CalendarDays },
  { key: "transactions", name: "Transactions", icon: Receipt },
  { key: "reviews", name: "Reviews", icon: Star },
  { key: "activity", name: "Activity Log", icon: Activity },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Main Component ────────────────────────────────────────────────────────

export default function AdminStPropertyView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabKey>("details");

  const { data: property, isLoading, isError } = useQuery<any>({
    queryKey: ["/admin/st-properties", id],
    queryFn: () => api.get(`/admin/st-properties/${id}`),
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
        <p className="text-muted-foreground">Property not found.</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
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
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-lg truncate max-w-[400px]">
            {property.publicName || "Untitled Property"}
          </h1>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {property.pmName && <span>PM: <span className="font-medium text-foreground">{property.pmName}</span></span>}
          {property.poName && <span>PO: <span className="font-medium text-foreground">{property.poName}</span></span>}
        </div>
      </div>

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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 space-y-8">
            {activeTab === "details" && <DetailsTab p={property} />}
            {activeTab === "description" && <DescriptionTab p={property} />}
            {activeTab === "photos" && <PhotosTab p={property} />}
            {activeTab === "amenities" && <AmenitiesTab p={property} />}
            {activeTab === "pricing" && <PricingTab p={property} />}
            {activeTab === "policies" && <PoliciesTab p={property} />}
            {activeTab === "owner" && <OwnerTab p={property} />}
            {activeTab === "agreement" && <AgreementTab p={property} />}
            {activeTab === "inventory" && <InventoryTab propertyId={property.id} />}
            {activeTab === "investment" && <InvestmentTab propertyId={property.id} />}
            {activeTab === "calendar" && <CalendarTab propertyId={property.id} />}
            {activeTab === "bookings" && <BookingsTab propertyId={property.id} />}
            {activeTab === "transactions" && <TransactionsTab propertyId={property.id} />}
            {activeTab === "reviews" && <ReviewsTab propertyId={property.id} />}
            {activeTab === "activity" && <ActivityTab propertyId={property.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab views ──────────────────────────────────────────────────────────────

function DetailsTab({ p }: { p: any }) {
  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-1"><Home className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Basic Information</h3></div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Property Type" value={p.propertyType?.replace(/_/g, " ")} />
          <InfoRow label="Unit Number" value={p.unitNumber} />
          <InfoRow label="Floor Number" value={p.floorNumber} />
          <InfoRow label="Building Name" value={p.buildingName} />
          <InfoRow label="Area (SQFT)" value={p.areaSqft} />
          <InfoRow label="View Type" value={p.viewType?.replace(/_/g, " ")} />
          <InfoRow label="Bedrooms" value={p.bedrooms} />
          <InfoRow label="Bathrooms" value={p.bathrooms} />
          <InfoRow label="Max Guests" value={p.maxGuests} />
          <InfoRow label="Ceiling Height (CM)" value={p.ceilingHeight} />
          <InfoRow label="Maid Room" value={p.maidRoom ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />} />
          <InfoRow label="Furnished" value={p.furnished ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />} />
          <InfoRow label="Smart Home" value={p.smartHome ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />} />
        </div>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-1"><MapPin className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Address</h3></div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Address Line 1" value={p.addressLine1} />
          <InfoRow label="Address Line 2" value={p.addressLine2} />
          <InfoRow label="City" value={p.city} />
          <InfoRow label="Area" value={p.areaName} />
        </div>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-1"><Building2 className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Parking & Access</h3></div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Parking Spaces" value={p.parkingSpaces ?? 0} />
          <InfoRow label="Parking Type" value={p.parkingType?.replace(/_/g, " ")} />
          <InfoRow label="Access Type" value={p.accessType?.replace(/_/g, " ")} />
        </div>
      </section>
    </>
  );
}

function DescriptionTab({ p }: { p: any }) {
  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-1"><FileText className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Listing Name</h3></div>
        <Separator className="mb-4" />
        <p className="text-sm font-medium">{p.publicName || "—"}</p>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-1"><FileText className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Short Description</h3></div>
        <Separator className="mb-4" />
        <p className="text-sm whitespace-pre-wrap">{p.shortDescription || "—"}</p>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-1"><FileText className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Long Description</h3></div>
        <Separator className="mb-4" />
        <p className="text-sm whitespace-pre-wrap">{p.longDescription || "—"}</p>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-1"><FileText className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Internal Notes</h3></div>
        <Separator className="mb-4" />
        <p className="text-sm whitespace-pre-wrap text-muted-foreground italic">{p.internalNotes || "No internal notes."}</p>
      </section>
    </>
  );
}

function PhotosTab({ p }: { p: any }) {
  const photos = p.photos || [];
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Camera className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Photos</h3>
        <span className="text-sm text-muted-foreground">({photos.length})</span>
      </div>
      <Separator className="mb-4" />
      {photos.length === 0 ? (
        <div className="text-center py-12"><Camera className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-muted-foreground">No photos uploaded.</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo: any, i: number) => (
            <div key={photo.id || i} className="relative rounded-lg overflow-hidden border bg-muted aspect-[4/3]">
              <img src={photo.url || photo.fileUrl} alt={photo.caption || `Photo ${i + 1}`} className="w-full h-full object-cover" />
              {photo.isCover && <Badge className="absolute top-2 left-2 bg-primary text-white text-xs">Cover</Badge>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AmenitiesTab({ p }: { p: any }) {
  const amenities = p.amenities || [];
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Amenities</h3>
        <span className="text-sm text-muted-foreground">({amenities.length})</span>
      </div>
      <Separator className="mb-4" />
      {amenities.length === 0 ? (
        <div className="text-center py-12"><Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-muted-foreground">No amenities selected.</p></div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {amenities.map((key: string) => (
            <div key={key} className="px-4 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
              {AMENITY_LABELS[key] || key.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function PricingTab({ p }: { p: any }) {
  const methods = parsePaymentMethods(p.acceptedPaymentMethods);
  const showBank = methods.includes("bank_transfer");
  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-1"><DollarSign className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Rates</h3></div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Nightly Rate" value={p.nightlyRate ? `AED ${p.nightlyRate}` : null} />
          <InfoRow label="Weekend Rate" value={p.weekendRate ? `AED ${p.weekendRate}` : null} />
          <InfoRow label="Minimum Stay" value={p.minimumStay ? `${p.minimumStay} night(s)` : null} />
        </div>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-1"><DollarSign className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Fees</h3></div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Cleaning Fee" value={p.cleaningFee ? `AED ${p.cleaningFee}` : null} />
          <InfoRow label="Security Deposit" value={p.securityDepositRequired ? (p.securityDepositAmount ? `AED ${p.securityDepositAmount}` : "Required") : "Not required"} />
        </div>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-1"><CreditCard className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Guest Payment Methods</h3></div>
        <Separator className="mb-4" />
        {methods.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {methods.map((m: string) => (
              <div key={m} className="px-4 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20 capitalize">{m.replace(/_/g, " ")}</div>
            ))}
          </div>
        )}
        {showBank && (
          <div className="rounded-md border p-4">
            <h4 className="text-sm font-medium mb-3">Bank Transfer Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <InfoRow label="Account Belongs To" value={p.bankAccountBelongsTo?.replace(/_/g, " ")} />
              <InfoRow label="Bank Name" value={p.bankName} />
              <InfoRow label="Account Holder" value={p.accountHolderName} />
              <InfoRow label="Account Number" value={p.accountNumber} />
              <InfoRow label="IBAN" value={p.iban} />
              <InfoRow label="SWIFT Code" value={p.swiftCode} />
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function PoliciesTab({ p }: { p: any }) {
  const policies = p.policies || [];
  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-1"><Clock className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Check-in & Check-out</h3></div>
        <Separator className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <InfoRow label="Check-in Time" value={formatTime(p.checkInTime)} />
          <InfoRow label="Check-out Time" value={formatTime(p.checkOutTime)} />
        </div>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-1"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Cancellation Policy</h3></div>
        <Separator className="mb-4" />
        <p className="text-sm font-medium">{CANCELLATION_LABELS[p.cancellationPolicy || ""] || p.cancellationPolicy || "—"}</p>
      </section>
      <section>
        <div className="flex items-center gap-2 mb-1"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">House Rules</h3><span className="text-sm text-muted-foreground">({policies.length})</span></div>
        <Separator className="mb-4" />
        {policies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom house rules.</p>
        ) : (
          <div className="space-y-2">
            {policies.map((pol: any) => (
              <div key={pol.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{pol.name}</p>
                {pol.description && <p className="text-xs text-muted-foreground mt-0.5">{pol.description}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function OwnerTab({ p }: { p: any }) {
  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-1"><Users className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Property Owner</h3></div>
        <Separator className="mb-4" />
        {p.poName ? (
          <div className="rounded-md border p-4">
            <InfoRow label="Owner" value={p.poName} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No property owner assigned.</p>
        )}
      </section>
      {p.commissionType && (
        <section>
          <div className="flex items-center gap-2 mb-1"><Percent className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Commission Structure</h3></div>
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="Commission Type" value={p.commissionType === "fixed_monthly" ? "Fixed Monthly" : p.commissionType === "percentage_per_booking" ? "Percentage per Booking" : p.commissionType} />
            <InfoRow label="Commission Value" value={p.commissionValue ? (p.commissionType === "percentage_per_booking" ? `${p.commissionValue}%` : `AED ${p.commissionValue}`) : null} />
          </div>
        </section>
      )}
      {p.pmName && (
        <section>
          <div className="flex items-center gap-2 mb-1"><Users className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Property Manager</h3></div>
          <Separator className="mb-4" />
          <div className="rounded-md border p-4">
            <InfoRow label="Manager" value={p.pmName} />
          </div>
        </section>
      )}
    </>
  );
}

function AgreementTab({ p }: { p: any }) {
  const acq = p.acquisitionDetails || {};
  const documents = p.documents || [];
  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-1"><ClipboardCheck className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Acquisition Type</h3></div>
        <Separator className="mb-4" />
        <InfoRow label="Type" value={<span className="capitalize">{p.acquisitionType?.replace(/_/g, " ") || "—"}</span>} />
      </section>
      {p.acquisitionType === "cash" && (
        <section>
          <div className="flex items-center gap-2 mb-1"><DollarSign className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Cash Details</h3></div>
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="Purchase Price" value={acq.purchasePrice ? `AED ${acq.purchasePrice}` : null} />
            <InfoRow label="Purchase Date" value={acq.purchaseDate} />
          </div>
        </section>
      )}
      <section>
        <div className="flex items-center gap-2 mb-1"><FileText className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Documents</h3><span className="text-sm text-muted-foreground">({documents.length})</span></div>
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
                    <p className="text-sm font-medium capitalize">{doc.documentType?.replace(/_/g, " ") || doc.name}</p>
                    {doc.hasExpiry && doc.expiryDate && <p className="text-xs text-muted-foreground">Expires: {doc.expiryDate}</p>}
                  </div>
                </div>
                {doc.fileUrl && (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
                    <ExternalLink className="h-3.5 w-3.5" />View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {p.acquisitionType && (
        <section>
          <div className="flex items-center gap-2 mb-1"><Droplets className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Utilities</h3></div>
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="DEWA Number" value={acq.dewaNo} />
            <InfoRow label="Internet Provider" value={acq.internetProvider} />
            <InfoRow label="Internet Account No." value={acq.internetAccountNo} />
            <InfoRow label="Gas Number" value={acq.gasNo} />
          </div>
        </section>
      )}
      <section>
        <div className="flex items-center gap-2 mb-1"><ClipboardCheck className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Confirmation</h3></div>
        <Separator className="mb-4" />
        <InfoRow
          label="Agreement Confirmed"
          value={
            p.agreementConfirmed || p.confirmed
              ? <span className="flex items-center gap-1.5 text-green-600"><Check className="h-4 w-4" /> Confirmed</span>
              : <span className="flex items-center gap-1.5 text-muted-foreground"><X className="h-4 w-4" /> Not confirmed</span>
          }
        />
      </section>
    </>
  );
}

// ─── Helpers for new tabs ────────────────────────────────────────────────────

function fmtCurrency(v: any) {
  const n = parseFloat(v || "0");
  if (isNaN(n)) return "AED 0";
  return `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtRelative(dateStr: string) {
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

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: "Requested", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800 border-blue-300" },
  checked_in: { label: "Checked In", color: "bg-green-100 text-green-800 border-green-300" },
  checked_out: { label: "Checked Out", color: "bg-orange-100 text-orange-800 border-orange-300" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 border-red-300" },
  declined: { label: "Declined", color: "bg-gray-100 text-gray-800 border-gray-300" },
};

const ACTIVITY_LABELS: Record<string, { label: string; color: string }> = {
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

// ─── Tab: Inventory ──────────────────────────────────────────────────────────

function InventoryTab({ propertyId }: { propertyId: string }) {
  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: [`/admin/st-properties/${propertyId}/inventory`],
    queryFn: () => api.get(`/st-properties/${propertyId}/inventory`),
  });
  const { data: summary } = useQuery<any>({
    queryKey: [`/admin/st-properties/${propertyId}/inventory-summary`],
    queryFn: () => api.get(`/st-properties/${propertyId}/inventory-summary`),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <Package className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Inventory</h3>
        <span className="text-sm text-muted-foreground">({items.length} item types)</span>
      </div>
      <Separator />

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-blue-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Value</p>
          <p className="text-xl font-bold text-blue-700">{fmtCurrency(summary?.totalValue)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-emerald-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Items</p>
          <p className="text-xl font-bold text-emerald-700">{summary?.totalItems || 0} types · {summary?.totalQuantity || 0} units</p>
        </div>
        <div className="rounded-lg border p-4 bg-purple-50/50">
          <p className="text-xs text-muted-foreground mb-1">Categories</p>
          <p className="text-xl font-bold text-purple-700">{summary?.categoryBreakdown?.length || 0}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No inventory items.</p>
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
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => {
                const condColor = item.condition === "New" || item.condition === "Good" ? "text-green-700" : item.condition === "Damaged" || item.condition === "Poor" ? "text-red-700" : "text-yellow-700";
                return (
                  <tr key={item.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{item.name}</p>
                      {item.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.notes}</p>}
                    </td>
                    <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[10px]">{item.category}</Badge></td>
                    <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{fmtCurrency(item.unitCost)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmtCurrency(item.totalCost)}</td>
                    <td className={`px-4 py-2.5 ${condColor}`}>{item.condition}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{item.location || "—"}</td>
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

// ─── Tab: Investment ──────────────────────────────────────────────────────────

function InvestmentTab({ propertyId }: { propertyId: string }) {
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: [`/admin/st-properties/${propertyId}/investment-summary`],
    queryFn: () => api.get(`/st-properties/${propertyId}/investment-summary`),
  });

  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: [`/admin/st-properties/${propertyId}/transactions`],
    queryFn: () => api.get(`/st-properties/${propertyId}/transactions`),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const netProfit = parseFloat(summary?.netProfit || "0");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Investment Overview</h3>
      </div>
      <Separator />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4 bg-blue-50/50">
          <p className="text-xs text-muted-foreground mb-1">Purchase Price</p>
          <p className="text-xl font-bold text-blue-700">{fmtCurrency(summary?.purchasePrice)}</p>
          {summary?.purchaseDate && <p className="text-xs text-muted-foreground mt-1">{fmtDate(summary.purchaseDate)}</p>}
        </div>
        <div className="rounded-lg border p-4 bg-indigo-50/50">
          <p className="text-xs text-muted-foreground mb-1">Inventory Value</p>
          <p className="text-xl font-bold text-indigo-700">{fmtCurrency(summary?.inventoryValue)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-orange-50/50">
          <p className="text-xs text-muted-foreground mb-1">Additional Expenses</p>
          <p className="text-xl font-bold text-orange-700">{fmtCurrency(summary?.totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-1">{summary?.expenseCount || 0} expense(s)</p>
        </div>
        <div className="rounded-lg border p-4 bg-green-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Investment</p>
          <p className="text-xl font-bold text-green-700">{fmtCurrency(summary?.totalInvestment)}</p>
        </div>
      </div>

      <h4 className="text-sm font-semibold">Revenue</h4>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-emerald-50/50">
          <p className="text-xs text-muted-foreground mb-1">Rental Revenue</p>
          <p className="text-xl font-bold text-emerald-700">{fmtCurrency(summary?.totalIncome)}</p>
          <p className="text-xs text-muted-foreground mt-1">{summary?.bookingCount || 0} booking(s)</p>
        </div>
        <div className="rounded-lg border p-4 bg-purple-50/50">
          <p className="text-xs text-muted-foreground mb-1">PM Commission</p>
          <p className="text-xl font-bold text-purple-700">{fmtCurrency(summary?.totalCommission)}</p>
        </div>
        <div className="rounded-lg border p-4 bg-cyan-50/50">
          <p className="text-xs text-muted-foreground mb-1">Owner Payout</p>
          <p className="text-xl font-bold text-cyan-700">{fmtCurrency(summary?.totalOwnerPayout)}</p>
        </div>
      </div>

      <div className={`rounded-lg border p-4 ${netProfit >= 0 ? "bg-green-50/50" : "bg-red-50/50"}`}>
        <p className="text-xs text-muted-foreground mb-1">Net Profit</p>
        <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmtCurrency(summary?.netProfit)}</p>
        <p className="text-xs text-muted-foreground mt-1">Revenue − Commission − Inventory − Expenses</p>
      </div>

      <h4 className="text-sm font-semibold">Security Deposits</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Collected", value: summary?.depositsCollected, color: "text-slate-700" },
          { label: "Held", value: summary?.depositsHeld, color: "text-amber-700" },
          { label: "Returned", value: summary?.depositsReturned, color: "text-teal-700" },
          { label: "Forfeited", value: summary?.depositsForfeited, color: "text-red-700" },
        ].map(d => (
          <div key={d.label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
            <p className={`text-lg font-bold ${d.color}`}>{fmtCurrency(d.value)}</p>
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-3">Transaction History</h4>
        {transactions.length === 0 ? (
          <div className="text-center py-10 border rounded-lg">
            <Receipt className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
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
                  const amountStr = tx.amount?.toString() || "0";
                  const isPositive = amountStr.startsWith("+");
                  const isNegative = amountStr.startsWith("-");
                  const isHold = tx.direction === "hold";
                  const amountColor = isPositive ? "text-emerald-700" : isNegative ? "text-red-700" : isHold ? "text-amber-700" : "";
                  const displayAmount = isHold
                    ? `AED ${parseFloat(amountStr).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} (held)`
                    : `${isPositive ? "+" : isNegative ? "−" : ""}AED ${Math.abs(parseFloat(amountStr)).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
                  return (
                    <tr key={tx.id} className="border-t hover:bg-accent/30">
                      <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(tx.date)}</td>
                      <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[11px]">{tx.category}</Badge></td>
                      <td className="px-4 py-2.5 truncate max-w-[240px]">{tx.description || "—"}</td>
                      <td className={cn("px-4 py-2.5 text-right font-semibold whitespace-nowrap", amountColor)}>{displayAmount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Calendar ───────────────────────────────────────────────────────────

function CalendarTab({ propertyId }: { propertyId: string }) {
  const [current, setCurrent] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  const startDate = `${current.year}-${String(current.month + 1).padStart(2, "0")}-01`;
  const endD = new Date(current.year, current.month + 1, 0);
  const endDate = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/admin/st-properties/${propertyId}/calendar-pricing`, startDate, endDate],
    queryFn: () => api.get(`/st-properties/${propertyId}/calendar-pricing?from=${startDate}&to=${endDate}`),
  });

  const prev = () => setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  const next = () => setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });

  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(current.year, current.month, 1).getDay();
  const monthLabel = new Date(current.year, current.month).toLocaleString("default", { month: "long", year: "numeric" });

  const dayStr = (day: number) => `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const isInRange = (ds: string, start: string, end: string) => ds >= start.slice(0, 10) && ds <= end.slice(0, 10);

  const cells: (number | null)[] = (Array.from({ length: firstDayOfWeek }, () => null) as (number | null)[]).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  const bookings: any[] = data?.bookings || [];
  const blocked: any[] = data?.blocked || [];
  const pricing: any[] = data?.pricing || [];
  const defaults = data?.defaults || {};

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const getDayRate = (day: number): string | null => {
    const ds = dayStr(day);
    const custom = pricing.find(p => p.date === ds);
    if (custom) return custom.price;
    const dow = new Date(current.year, current.month, day).getDay();
    const isWeekend = dow === 5 || dow === 6; // Fri/Sat
    if (isWeekend && defaults.weekendRate) return defaults.weekendRate;
    if (defaults.nightlyRate) return defaults.nightlyRate;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Calendar & Pricing</h3>
      </div>
      {(defaults.nightlyRate || defaults.weekendRate) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
          {defaults.nightlyRate && <span>Weekday: <span className="font-semibold text-foreground">AED {defaults.nightlyRate}</span></span>}
          {defaults.weekendRate && <span>Weekend (Fri–Sat): <span className="font-semibold text-foreground">AED {defaults.weekendRate}</span></span>}
          <span className="text-emerald-700">■ Custom price</span>
        </div>
      )}
      <Separator />

      <div className="flex items-center justify-between">
        <button onClick={prev} className="p-1 rounded border hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-semibold text-sm">{monthLabel}</span>
        <button onClick={next} className="p-1 rounded border hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-xs font-medium py-2 bg-muted-foreground/5">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} className="min-h-[72px] bg-background" />;
            const ds = dayStr(day);
            const dayBookings = bookings.filter(b => isInRange(ds, b.checkIn, b.checkOut));
            const dayBlocked = blocked.filter(bl => isInRange(ds, bl.startDate, bl.endDate));
            const pricingEntry = pricing.find(p => p.date === ds);
            const displayRate = getDayRate(day);
            const isSelected = selectedDay === day;
            return (
              <div
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn("min-h-[72px] p-1 bg-background cursor-pointer hover:bg-muted/50 transition-colors", isSelected && "ring-2 ring-primary ring-inset")}
              >
                <span className="text-xs font-medium">{day}</span>
                {displayRate && (
                  <div className={cn("text-[9px] font-medium", pricingEntry ? "text-emerald-700" : "text-muted-foreground")}>
                    AED {displayRate}
                  </div>
                )}
                <div className="mt-0.5 space-y-0.5">
                  {dayBookings.slice(0, 2).map(b => {
                    const cfg = BOOKING_STATUS[b.status];
                    return <div key={b.id} className={cn("text-[10px] leading-tight px-1 rounded truncate", cfg?.color ?? "bg-gray-100")}>{b.guestName?.split(" ")[0] || "Guest"}</div>;
                  })}
                  {dayBookings.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayBookings.length - 2}</div>}
                  {dayBlocked.map(bl => <div key={bl.id} className="text-[10px] leading-tight px-1 rounded bg-gray-200 text-gray-600 truncate">Blocked</div>)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDay && (
        <div className="border rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-2">
            {new Date(current.year, current.month, selectedDay).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </h4>
          {bookings.filter(b => isInRange(dayStr(selectedDay), b.checkIn, b.checkOut)).map(b => (
            <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <span className="font-medium">{b.guestName || "Guest"}</span>
              <Badge variant="outline" className={cn("text-xs border", BOOKING_STATUS[b.status]?.color)}>{BOOKING_STATUS[b.status]?.label || b.status}</Badge>
            </div>
          ))}
          {blocked.filter(bl => isInRange(dayStr(selectedDay), bl.startDate, bl.endDate)).map(bl => (
            <div key={bl.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <span className="font-medium text-gray-600">Blocked</span>
              <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">{bl.reason || "No reason"}</Badge>
            </div>
          ))}
          {bookings.filter(b => isInRange(dayStr(selectedDay), b.checkIn, b.checkOut)).length === 0 &&
            blocked.filter(bl => isInRange(dayStr(selectedDay), bl.startDate, bl.endDate)).length === 0 &&
            <p className="text-sm text-muted-foreground">No bookings or blocks.</p>}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Bookings ───────────────────────────────────────────────────────────

function BookingsTab({ propertyId }: { propertyId: string }) {
  const { data: bookings = [], isLoading } = useQuery<any[]>({
    queryKey: [`/admin/bookings/property/${propertyId}`],
    queryFn: () => api.get(`/bookings/property/${propertyId}`),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === "requested").length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    checkedIn: bookings.filter(b => b.status === "checked_in").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Bookings</h3>
      </div>
      <Separator />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Pending", value: stats.pending },
          { label: "Confirmed", value: stats.confirmed },
          { label: "Checked In", value: stats.checkedIn },
        ].map(s => (
          <div key={s.label} className="border rounded-lg p-3">
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No bookings yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Guest</th>
                <th className="px-4 py-2 font-medium">Check-In</th>
                <th className="px-4 py-2 font-medium">Check-Out</th>
                <th className="px-4 py-2 font-medium">Nights</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b: any) => {
                const cfg = BOOKING_STATUS[b.status] ?? { label: b.status, color: "bg-gray-100 text-gray-800 border-gray-300" };
                return (
                  <tr key={b.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{b.guestName || "—"}</p>
                      <p className="text-xs text-muted-foreground">{b.source || ""}</p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(b.checkInDate)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(b.checkOutDate)}</td>
                    <td className="px-4 py-2.5">{b.totalNights || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmtCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn("text-xs border", cfg.color)}>{cfg.label}</Badge>
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

// ─── Tab: Transactions ───────────────────────────────────────────────────────

function TransactionsTab({ propertyId }: { propertyId: string }) {
  const { data: transactions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/admin/st-properties/${propertyId}/transactions`],
    queryFn: () => api.get(`/st-properties/${propertyId}/transactions`),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <Receipt className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Transactions</h3>
      </div>
      <Separator />

      {transactions.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Receipt className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No transactions recorded.</p>
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
                const amountStr = tx.amount?.toString() || "0";
                const isPositive = amountStr.startsWith("+");
                const isNegative = amountStr.startsWith("-");
                const isHold = tx.direction === "hold";
                const amountColor = isPositive ? "text-emerald-700" : isNegative ? "text-red-700" : isHold ? "text-amber-700" : "";
                const displayAmount = isHold
                  ? `AED ${parseFloat(amountStr).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} (held)`
                  : `${isPositive ? "+" : isNegative ? "−" : ""}AED ${Math.abs(parseFloat(amountStr)).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
                return (
                  <tr key={tx.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(tx.date)}</td>
                    <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[11px]">{tx.category}</Badge></td>
                    <td className="px-4 py-2.5 truncate max-w-[240px]">{tx.description || "—"}</td>
                    <td className={cn("px-4 py-2.5 text-right font-semibold whitespace-nowrap", amountColor)}>{displayAmount}</td>
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

// ─── Tab: Reviews ────────────────────────────────────────────────────────────

function ReviewsTab({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useQuery<{ reviews: any[]; total: number; avgRating: string }>({
    queryKey: [`/admin/st-properties/${propertyId}/reviews`],
    queryFn: () => api.get(`/public/properties/${propertyId}/reviews?limit=50`),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const reviews = data?.reviews || [];
  const avg = parseFloat(data?.avgRating || "0");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <Star className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Guest Reviews</h3>
      </div>
      <Separator />

      <div className="flex items-center gap-6">
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
          <p className="text-muted-foreground">No reviews yet.</p>
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
                    <p>{r.createdAt ? fmtDate(r.createdAt) : ""}</p>
                  </div>
                </div>
                {r.pmResponse && (
                  <div className="mt-3 bg-muted/50 rounded p-3 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">PM Response</p>
                    <p>{r.pmResponse}</p>
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

// ─── Tab: Activity Log ───────────────────────────────────────────────────────

function ActivityTab({ propertyId }: { propertyId: string }) {
  const { data: activities = [], isLoading } = useQuery<any[]>({
    queryKey: [`/admin/st-properties/${propertyId}/activity`],
    queryFn: () => api.get(`/st-properties/${propertyId}/activity`),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Activity Log</h3>
      </div>
      <Separator />

      {activities.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {activities.map((act: any, i: number) => {
            const info = ACTIVITY_LABELS[act.action] || { label: act.action, color: "bg-gray-100 text-gray-700" };
            return (
              <div key={act.id} className="flex gap-4 py-3 border-b last:border-b-0">
                <div className="flex flex-col items-center pt-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                  {i < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-[10px] font-medium", info.color)}>{info.label}</Badge>
                    <span className="text-sm">{act.description}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{act.userName || "System"}</span>
                    <span>•</span>
                    <span>{fmtRelative(act.createdAt)}</span>
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
