import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
