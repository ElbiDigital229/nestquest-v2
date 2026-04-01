import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { api } from "@/lib/api";
import SharedBookings from "@/pages/portal/my-bookings";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  ArrowLeft,
  Home,
  FileText,
  Camera,
  Sparkles,
  DollarSign,
  ShieldCheck,
  TrendingUp,
  Activity,
  CalendarDays,
  Star,
  Package,
  Receipt,
  MapPin,
  BedDouble,
  Bath,
  Maximize2,
  Eye,
  Building2,
  Clock,
  Check,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────

interface PropertyData {
  id: string;
  publicName: string | null;
  status: string;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  addressLine1: string | null;
  city: string | null;
  areaName: string | null;
  unitNumber: string | null;
  buildingName: string | null;
  areaSqft: number | null;
  viewType: string | null;
  maidRoom: boolean;
  furnished: boolean;
  smartHome: boolean;
  shortDescription: string | null;
  longDescription: string | null;
  nightlyRate: string | null;
  weekendRate: string | null;
  minimumStay: number | null;
  cleaningFee: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  cancellationPolicy: string | null;
  photos: any[];
  amenities: string[];
  acquisitionDetails: any;
  [key: string]: any;
}

// ─── Tabs ──────────────────────────────────────────────

const TABS = [
  { key: "details", name: "Property Details", icon: Home },
  { key: "description", name: "Description", icon: FileText },
  { key: "photos", name: "Photos", icon: Camera },
  { key: "amenities", name: "Amenities", icon: Sparkles },
  { key: "pricing", name: "Pricing", icon: DollarSign },
  { key: "policies", name: "Policies", icon: ShieldCheck },
  { key: "inventory", name: "Inventory", icon: Package },
  { key: "investment", name: "Investment", icon: TrendingUp },
  { key: "calendar", name: "Calendar", icon: CalendarDays },
  { key: "bookings", name: "Bookings", icon: CalendarDays },
  { key: "transactions", name: "Transactions", icon: Receipt },
  { key: "reviews", name: "Reviews", icon: Star },
  { key: "activity", name: "Activity Log", icon: Activity },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const statusBadge: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  active: { label: "Active", className: "bg-green-600 text-white" },
  inactive: { label: "Inactive", className: "bg-gray-200 text-gray-600" },
};

// ─── Helpers ──────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2">
      <span className="text-sm text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

function formatCurrency(amount: string | number | null | undefined) {
  if (!amount) return "AED 0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `AED ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDateShort(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const EXPENSE_CATEGORIES: Record<string, string> = {
  maintenance: "Maintenance",
  renovation: "Renovation",
  furnishing: "Furnishing",
  insurance: "Insurance",
  service_charge: "Service Charge",
  utility: "Utility",
  management_fee: "Management Fee",
  legal: "Legal",
  government_fee: "Government Fee",
  commission: "Commission",
  other: "Other",
};

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

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi", air_conditioning: "Air Conditioning", tv: "TV",
  swimming_pool: "Swimming Pool", gym: "Gym", free_parking: "Free Parking",
  elevator: "Elevator", "24_7_security": "24/7 Security", kitchen: "Kitchen",
  washer: "Washer", dryer: "Dryer", iron: "Iron", hair_dryer: "Hair Dryer",
  workspace: "Workspace", concierge: "Concierge", doorman: "Doorman",
  storage_room: "Storage Room", central_gas: "Central Gas", cctv: "CCTV",
  intercom: "Intercom", beach_access: "Beach Access", bbq_area: "BBQ Area",
  garden: "Garden", kids_play_area: "Kids Play Area", coffee_machine: "Coffee Machine",
  dishwasher: "Dishwasher", microwave: "Microwave", oven: "Oven",
  pets_allowed: "Pets Allowed", smoking_area: "Smoking Area",
  housekeeping_available: "Housekeeping Available",
};

// ─── Component ──────────────────────────────────────────

export default function PoPropertyView({ id: propId }: { id?: string } = {}) {
  const [match, params] = useRoute("/portal/po-properties/:id");
  const [, navigate] = useLocation();
  const id = propId || params?.id;

  const [activeTab, setActiveTab] = useState<TabKey>("details");

  const { data: property, isLoading } = useQuery<PropertyData>({
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

  const badge = statusBadge[property.status] || statusBadge.draft;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between h-14 px-4 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/portal/po-properties")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-lg truncate max-w-[400px]">
            {property.publicName || "Untitled Property"}
          </h1>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r overflow-y-auto bg-muted/30 shrink-0">
          <nav className="p-2 space-y-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors text-left",
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                {tab.name}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "details" && <DetailsTab property={property} />}
          {activeTab === "description" && <DescriptionTab property={property} />}
          {activeTab === "photos" && <PhotosTab property={property} />}
          {activeTab === "amenities" && <AmenitiesTab property={property} />}
          {activeTab === "pricing" && <PricingTab property={property} />}
          {activeTab === "policies" && <PoliciesTab property={property} />}
          {activeTab === "inventory" && <InventoryTab propertyId={property.id} />}
          {activeTab === "investment" && <InvestmentTab property={property} />}
          {activeTab === "calendar" && <CalendarTab propertyId={property.id} />}
          {activeTab === "bookings" && <SharedBookings propertyId={property.id} embedded />}
          {activeTab === "transactions" && <TransactionsTab propertyId={property.id} />}
          {activeTab === "reviews" && <ReviewsTab propertyId={property.id} />}
          {activeTab === "activity" && <ActivityTab property={property} />}
        </div>
      </div>
    </div>
  );
}

// ─── Details Tab ──────────────────────────────────────────

function DetailsTab({ property }: { property: PropertyData }) {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Home className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Property Details</h3>
      </div>
      <Separator />
      <InfoRow label="Property Type" value={property.propertyType?.replace(/_/g, " ")} />
      <InfoRow label="Bedrooms" value={property.bedrooms?.toString()} />
      <InfoRow label="Bathrooms" value={property.bathrooms?.toString()} />
      <InfoRow label="Max Guests" value={property.maxGuests?.toString()} />
      <InfoRow label="Area (sqft)" value={property.areaSqft?.toString()} />
      <InfoRow label="View Type" value={property.viewType?.replace(/_/g, " ")} />
      <InfoRow label="Building" value={property.buildingName} />
      <InfoRow label="Unit" value={property.unitNumber} />
      <InfoRow label="City" value={property.city?.replace(/_/g, " ")} />
      <InfoRow label="Area" value={property.areaName} />
      <InfoRow label="Address" value={property.addressLine1} />
      <InfoRow label="Maid Room" value={property.maidRoom ? "Yes" : "No"} />
      <InfoRow label="Furnished" value={property.furnished ? "Yes" : "No"} />
      <InfoRow label="Smart Home" value={property.smartHome ? "Yes" : "No"} />
    </div>
  );
}

// ─── Description Tab ──────────────────────────────────────────

function DescriptionTab({ property }: { property: PropertyData }) {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Description</h3>
      </div>
      <Separator />
      <div>
        <h4 className="text-sm font-medium mb-2">Short Description</h4>
        <p className="text-sm text-muted-foreground">{property.shortDescription || "—"}</p>
      </div>
      <div>
        <h4 className="text-sm font-medium mb-2">Full Description</h4>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.longDescription || "—"}</p>
      </div>
    </div>
  );
}

// ─── Photos Tab ──────────────────────────────────────────

function PhotosTab({ property }: { property: PropertyData }) {
  const photos = property.photos || [];
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <Camera className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Photos ({photos.length})</h3>
      </div>
      <Separator className="mb-6" />
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No photos uploaded.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((photo: any) => (
            <div key={photo.id} className="relative rounded-lg overflow-hidden border">
              <img src={photo.url} alt={photo.caption || ""} className="w-full h-40 object-cover" />
              {photo.isCover && (
                <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px]">Cover</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Amenities Tab ──────────────────────────────────────────

function AmenitiesTab({ property }: { property: PropertyData }) {
  const amenities = property.amenities || [];
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Amenities ({amenities.length})</h3>
      </div>
      <Separator className="mb-6" />
      {amenities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No amenities selected.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {amenities.map((a: string) => (
            <Badge key={a} variant="secondary" className="px-3 py-1.5">{AMENITY_LABELS[a] || a}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pricing Tab ──────────────────────────────────────────

function PricingTab({ property }: { property: PropertyData }) {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Pricing</h3>
      </div>
      <Separator />
      <InfoRow label="Nightly Rate" value={property.nightlyRate ? formatCurrency(property.nightlyRate) : "—"} />
      <InfoRow label="Weekend Rate" value={property.weekendRate ? formatCurrency(property.weekendRate) : "—"} />
      <InfoRow label="Minimum Stay" value={property.minimumStay ? `${property.minimumStay} night(s)` : "—"} />
      <InfoRow label="Cleaning Fee" value={property.cleaningFee ? formatCurrency(property.cleaningFee) : "—"} />
    </div>
  );
}

// ─── Policies Tab ──────────────────────────────────────────

function PoliciesTab({ property }: { property: PropertyData }) {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Policies</h3>
      </div>
      <Separator />
      <InfoRow label="Check-in Time" value={property.checkInTime} />
      <InfoRow label="Check-out Time" value={property.checkOutTime} />
      <InfoRow label="Cancellation" value={property.cancellationPolicy?.replace(/_/g, " ")} />
    </div>
  );
}

// ─── Investment Tab (Read-Only for PO) ──────────────────────────────────────────

function InvestmentTab({ property }: { property: PropertyData }) {
  const { data: summary } = useQuery<any>({
    queryKey: [`/st-properties/${property.id}/investment-summary`],
    queryFn: () => api.get(`/st-properties/${property.id}/investment-summary`),
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Investment Overview</h3>
      </div>
      <Separator className="mb-6" />

      {/* Investment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border p-4 bg-blue-50/50">
          <p className="text-xs text-muted-foreground mb-1">Purchase Price</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(summary?.purchasePrice)}</p>
          {summary?.purchaseDate && <p className="text-xs text-muted-foreground mt-1">Purchased {formatDateShort(summary.purchaseDate)}</p>}
          {summary?.acquisitionType && <Badge variant="secondary" className="mt-2 text-[10px]">{summary.acquisitionType.replace(/_/g, " ").toUpperCase()}</Badge>}
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
          <p className={`text-xl font-bold ${parseFloat(summary?.netProfit || "0") >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(summary?.netProfit)}</p>
          <p className="text-xs text-muted-foreground mt-1">Revenue - Commission - Inventory - Expenses</p>
        </div>
      </div>

      {/* Security Deposits */}
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

      {/* Expense Category Breakdown */}
      {summary?.categoryBreakdown?.length > 0 && (
        <div className="mb-8">
          <h4 className="text-sm font-semibold mb-3">Expense Breakdown by Category</h4>
          <div className="flex flex-wrap gap-2">
            {summary.categoryBreakdown.map((cat: any) => {
              const pct = parseFloat(summary.totalExpenses) > 0 ? ((parseFloat(cat.totalCost) / parseFloat(summary.totalExpenses)) * 100).toFixed(0) : "0";
              return (
                <div key={cat.category} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <Badge className="bg-gray-100 text-gray-700">{cat.category}</Badge>
                  <span className="font-medium">{formatCurrency(cat.totalCost)}</span>
                  <span className="text-muted-foreground text-xs">({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <PoTransactionHistory propertyId={property.id} />
    </div>
  );
}

// ── PO Transaction History ──
function PoTransactionHistory({ propertyId }: { propertyId: string }) {
  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: [`/st-properties/${propertyId}/transactions`],
    queryFn: () => api.get(`/st-properties/${propertyId}/transactions`),
  });

  const TX_STYLES: Record<string, string> = {
    purchase: "bg-blue-100 text-blue-800",
    expense: "bg-orange-100 text-orange-800",
    booking_income: "bg-emerald-100 text-emerald-800",
    security_deposit_in: "bg-amber-100 text-amber-800",
    security_deposit_out: "bg-teal-100 text-teal-800",
    security_deposit_forfeited: "bg-red-100 text-red-800",
    commission: "bg-purple-100 text-purple-800",
  };

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">Transaction History</h4>
      {transactions.length === 0 ? (
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
                const amountStr = tx.amount?.toString() || "0";
                const isPositive = amountStr.startsWith("+");
                const isNegative = amountStr.startsWith("-");
                const isHold = tx.direction === "hold";
                const amountColor = isPositive ? "text-emerald-700" : isNegative ? "text-red-700" : isHold ? "text-amber-700" : "";
                const displayAmount = isHold
                  ? `AED ${parseFloat(amountStr).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} (held)`
                  : `${isPositive ? "+" : isNegative ? "-" : ""}AED ${Math.abs(parseFloat(amountStr)).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

                return (
                  <tr key={tx.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{tx.date ? formatDateShort(tx.date) : "—"}</td>
                    <td className="px-4 py-2.5"><Badge className={cn("text-[11px] border-0", TX_STYLES[tx.type] || "bg-gray-100 text-gray-700")}>{tx.category}</Badge></td>
                    <td className="px-4 py-2.5 truncate max-w-[250px]">{tx.description || "—"}</td>
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

// ── Inventory Tab (Read-Only for PO) ──
function InventoryTab({ propertyId }: { propertyId: string }) {
  const { data: items = [] } = useQuery<any[]>({
    queryKey: [`/st-properties/${propertyId}/inventory`],
    queryFn: () => api.get(`/st-properties/${propertyId}/inventory`),
  });
  const { data: summary } = useQuery<any>({
    queryKey: [`/st-properties/${propertyId}/inventory-summary`],
    queryFn: () => api.get(`/st-properties/${propertyId}/inventory-summary`),
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Inventory</h3>
      </div>
      <Separator className="mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border p-4 bg-blue-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Value</p>
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

      {items.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No inventory items yet.</p>
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
              {items.map((item: any) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2.5"><p className="font-medium">{item.name}</p>{item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}</td>
                  <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[10px]">{item.category}</Badge></td>
                  <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(item.unitCost)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(item.totalCost)}</td>
                  <td className="px-4 py-2.5">{item.condition}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{item.location || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Calendar Tab (Read-Only for PO) ──
function CalendarTab({ propertyId }: { propertyId: string }) {
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  const startDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-01`;
  const endD = new Date(currentMonth.year, currentMonth.month + 1, 0);
  const endDate = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;

  const { data } = useQuery<any>({
    queryKey: [`/st-properties/${propertyId}/calendar-pricing`, startDate],
    queryFn: () => api.get(`/st-properties/${propertyId}/calendar-pricing?from=${startDate}&to=${endDate}`),
  });

  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = fmtDate(new Date());
  const defaults = data?.defaults || {};
  const defaultNightly = parseFloat(defaults.nightlyRate || "0");
  const defaultWeekend = parseFloat(defaults.weekendRate || defaults.nightlyRate || "0");

  const bookingMap = new Map<string, any>();
  (data?.bookings || []).forEach((b: any) => {
    const s = new Date(b.checkIn.slice(0, 10) + "T12:00:00");
    const e = new Date(b.checkOut.slice(0, 10) + "T12:00:00");
    for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) bookingMap.set(fmtDate(d), b);
  });
  const blockedSet = new Set<string>();
  (data?.blocked || []).forEach((bl: any) => {
    const s = new Date((bl.startDate || "").slice(0, 10) + "T12:00:00");
    const e = new Date((bl.endDate || "").slice(0, 10) + "T12:00:00");
    for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) blockedSet.add(fmtDate(d));
  });
  const pricingMap = new Map<string, any>();
  (data?.pricing || []).forEach((p: any) => pricingMap.set(typeof p.date === "string" ? p.date.slice(0, 10) : fmtDate(new Date(p.date)), p));

  const firstDay = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1"><CalendarDays className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Calendar</h3></div>
      <Separator className="mb-4" />
      <div className="flex items-center justify-between mb-3">
        <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setCurrentMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 })}>← Prev</button>
        <h4 className="text-base font-semibold">{monthName}</h4>
        <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setCurrentMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 })}>Next →</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>)}
        {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} className="min-h-[70px]" />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isWeekend = new Date(currentMonth.year, currentMonth.month, day).getDay() === 5 || new Date(currentMonth.year, currentMonth.month, day).getDay() === 6;
          const booking = bookingMap.get(dateStr);
          const isBlocked = blockedSet.has(dateStr);
          const customPrice = pricingMap.get(dateStr);
          const price = customPrice ? parseFloat(customPrice.price) : (isWeekend ? defaultWeekend : defaultNightly);
          let bg = "bg-green-50 border-green-200";
          if (booking) bg = booking.status === "completed" || booking.status === "checked_out" ? "bg-gray-100 border-gray-300" : "bg-blue-50 border-blue-200";
          if (isBlocked) bg = "bg-red-50 border-red-200";
          if (customPrice && !booking && !isBlocked) bg = "bg-amber-50 border-amber-200";

          return (
            <div key={dateStr} className={`min-h-[70px] border rounded-md p-1.5 text-xs ${bg}`}>
              <div className="flex justify-between"><span className={`font-semibold ${dateStr === today ? "text-primary" : ""}`}>{day}</span>{isWeekend && <span className="text-[9px] text-muted-foreground">WE</span>}</div>
              <p className="font-bold mt-0.5 text-gray-700">{price > 0 ? price : "—"}</p>
              {booking && <p className="truncate text-[10px] text-blue-700 font-medium">{booking.guestName}</p>}
              {isBlocked && <p className="text-[10px] text-red-600">Blocked</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Transactions Tab (Read-Only for PO) ──
function TransactionsTab({ propertyId }: { propertyId: string }) {
  const { data: expenses = [] } = useQuery<any[]>({
    queryKey: [`/st-properties/${propertyId}/expenses`],
    queryFn: () => api.get(`/st-properties/${propertyId}/expenses`),
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1"><Receipt className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold">Transactions</h3></div>
      <Separator className="mb-6" />

      <PoTransactionHistory propertyId={propertyId} />

      <Separator className="my-6" />
      <h4 className="text-sm font-semibold mb-3">Expenses</h4>
      {expenses.length === 0 ? (
        <div className="text-center py-8 border rounded-lg"><p className="text-sm text-muted-foreground">No expenses recorded.</p></div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50 text-left"><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Category</th><th className="px-4 py-2 font-medium">Description</th><th className="px-4 py-2 font-medium">Responsible</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium text-right">Amount</th></tr></thead>
            <tbody>
              {expenses.map((exp: any) => (
                <tr key={exp.id} className="border-t">
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDateShort(exp.expenseDate)}</td>
                  <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[10px]">{exp.category?.replace(/_/g, " ")}</Badge></td>
                  <td className="px-4 py-2.5">{exp.description || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{exp.responsibleParty?.replace(/_/g, " ") || "—"}</td>
                  <td className="px-4 py-2.5"><Badge className={`text-[10px] border-0 ${exp.paymentStatus === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{exp.paymentStatus || "unpaid"}</Badge></td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(exp.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab (Read-Only for PO) ──────────────────────────────────────────

const BOOKING_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700" },
  checked_in: { label: "Checked In", className: "bg-indigo-100 text-indigo-700" },
  checked_out: { label: "Checked Out", className: "bg-purple-100 text-purple-700" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700" },
  expired: { label: "Expired", className: "bg-gray-100 text-gray-600" },
  no_show: { label: "No Show", className: "bg-orange-100 text-orange-700" },
};

const PAYMENT_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700" },
  partial: { label: "Partial", className: "bg-orange-100 text-orange-700" },
  refunded: { label: "Refunded", className: "bg-red-100 text-red-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

const PAYOUT_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700" },
};

function ViewBookings({ property }: { property: PropertyData }) {
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const { data: bookings, isLoading } = useQuery<any[]>({
    queryKey: [`/bookings/property/${property.id}`],
    queryFn: () => api.get(`/bookings/property/${property.id}`),
  });

  const confirmedStatuses = ["confirmed", "checked_in", "checked_out", "completed"];
  const totalBookings = bookings?.length || 0;
  const confirmedCount = bookings?.filter((b) => confirmedStatuses.includes(b.status)).length || 0;
  const completedCount = bookings?.filter((b) => b.status === "completed").length || 0;
  const totalIncome = bookings
    ?.filter((b) => confirmedStatuses.includes(b.status))
    .reduce((sum, b) => sum + parseFloat(b.totalAmount || "0"), 0) || 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Bookings</h3>
      </div>
      <Separator className="mb-6" />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border p-4 bg-blue-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Bookings</p>
          <p className="text-xl font-bold text-blue-700">{totalBookings}</p>
        </div>
        <div className="rounded-lg border p-4 bg-indigo-50/50">
          <p className="text-xs text-muted-foreground mb-1">Confirmed</p>
          <p className="text-xl font-bold text-indigo-700">{confirmedCount}</p>
        </div>
        <div className="rounded-lg border p-4 bg-green-50/50">
          <p className="text-xs text-muted-foreground mb-1">Completed</p>
          <p className="text-xl font-bold text-green-700">{completedCount}</p>
        </div>
        <div className="rounded-lg border p-4 bg-emerald-50/50">
          <p className="text-xs text-muted-foreground mb-1">Total Income</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
        </div>
      </div>

      {/* Bookings Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !bookings || bookings.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-muted-foreground mb-1">No Bookings Yet</h4>
          <p className="text-sm text-muted-foreground">
            Bookings for this property will appear here once guests start booking.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Guest</th>
                <th className="px-4 py-2 font-medium">Check-in</th>
                <th className="px-4 py-2 font-medium">Check-out</th>
                <th className="px-4 py-2 font-medium">Nights</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
                <th className="px-4 py-2 font-medium">Payment</th>
                <th className="px-4 py-2 font-medium">Payout</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking: any) => {
                const statusInfo = BOOKING_STATUS_BADGE[booking.status] || { label: booking.status, className: "bg-gray-100 text-gray-700" };
                const paymentInfo = PAYMENT_STATUS_BADGE[booking.paymentStatus] || { label: booking.paymentStatus || "—", className: "bg-gray-100 text-gray-700" };
                const payoutInfo = PAYOUT_STATUS_BADGE[booking.ownerPayoutStatus] || { label: booking.ownerPayoutStatus || "—", className: "bg-gray-100 text-gray-700" };
                return (
                  <tr
                    key={booking.id}
                    className="border-t cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <td className="px-4 py-2.5 font-medium truncate max-w-[150px]">{booking.guestName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateShort(booking.checkInDate)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateShort(booking.checkOutDate)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{booking.totalNights || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={cn("text-[11px]", statusInfo.className)}>{statusInfo.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(booking.totalAmount)}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={cn("text-[11px]", paymentInfo.className)}>{paymentInfo.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={cn("text-[11px]", payoutInfo.className)}>{payoutInfo.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-3 pt-2">
              <InfoRow label="Guest" value={selectedBooking.guestName} />
              <InfoRow label="Check-in" value={formatDateShort(selectedBooking.checkInDate)} />
              <InfoRow label="Check-out" value={formatDateShort(selectedBooking.checkOutDate)} />
              <InfoRow label="Nights" value={selectedBooking.totalNights?.toString()} />
              <InfoRow label="Guests" value={selectedBooking.numberOfGuests?.toString()} />
              <Separator />
              <InfoRow label="Total Amount" value={formatCurrency(selectedBooking.totalAmount)} />
              <InfoRow label="Commission" value={formatCurrency(selectedBooking.commissionAmount)} />
              <InfoRow label="Owner Payout" value={formatCurrency(selectedBooking.ownerPayoutAmount)} />
              <Separator />
              <InfoRow
                label="Status"
                value={
                  <Badge className={cn("text-[11px]", (BOOKING_STATUS_BADGE[selectedBooking.status] || { className: "bg-gray-100 text-gray-700" }).className)}>
                    {(BOOKING_STATUS_BADGE[selectedBooking.status] || { label: selectedBooking.status }).label}
                  </Badge>
                }
              />
              <InfoRow
                label="Payment"
                value={
                  <Badge className={cn("text-[11px]", (PAYMENT_STATUS_BADGE[selectedBooking.paymentStatus] || { className: "bg-gray-100 text-gray-700" }).className)}>
                    {(PAYMENT_STATUS_BADGE[selectedBooking.paymentStatus] || { label: selectedBooking.paymentStatus || "—" }).label}
                  </Badge>
                }
              />
              <InfoRow
                label="Payout Status"
                value={
                  <Badge className={cn("text-[11px]", (PAYOUT_STATUS_BADGE[selectedBooking.ownerPayoutStatus] || { className: "bg-gray-100 text-gray-700" }).className)}>
                    {(PAYOUT_STATUS_BADGE[selectedBooking.ownerPayoutStatus] || { label: selectedBooking.ownerPayoutStatus || "—" }).label}
                  </Badge>
                }
              />
              {selectedBooking.source && (
                <InfoRow label="Source" value={selectedBooking.source} />
              )}
              {selectedBooking.externalBookingRef && (
                <InfoRow label="Ext. Reference" value={selectedBooking.externalBookingRef} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Activity Log Tab ──────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  property_created: { label: "Created", color: "bg-green-100 text-green-700" },
  property_updated: { label: "Updated", color: "bg-blue-100 text-blue-700" },
  property_activated: { label: "Activated", color: "bg-green-100 text-green-700" },
  property_deactivated: { label: "Deactivated", color: "bg-red-100 text-red-700" },
  status_changed: { label: "Status Changed", color: "bg-purple-100 text-purple-700" },
  photo_added: { label: "Photo Added", color: "bg-cyan-100 text-cyan-700" },
  photo_removed: { label: "Photo Removed", color: "bg-orange-100 text-orange-700" },
  document_added: { label: "Document Added", color: "bg-teal-100 text-teal-700" },
  document_removed: { label: "Document Removed", color: "bg-orange-100 text-orange-700" },
  expense_added: { label: "Expense Added", color: "bg-amber-100 text-amber-700" },
  expense_updated: { label: "Expense Updated", color: "bg-yellow-100 text-yellow-700" },
  expense_deleted: { label: "Expense Deleted", color: "bg-red-100 text-red-700" },
  owner_assigned: { label: "Owner Assigned", color: "bg-indigo-100 text-indigo-700" },
  owner_removed: { label: "Owner Removed", color: "bg-red-100 text-red-700" },
  agreement_confirmed: { label: "Agreement Confirmed", color: "bg-green-100 text-green-700" },
  acquisition_updated: { label: "Acquisition Updated", color: "bg-blue-100 text-blue-700" },
  amenities_updated: { label: "Amenities Updated", color: "bg-violet-100 text-violet-700" },
  policies_updated: { label: "Policies Updated", color: "bg-slate-100 text-slate-700" },
  pricing_updated: { label: "Pricing Updated", color: "bg-emerald-100 text-emerald-700" },
  description_updated: { label: "Description Updated", color: "bg-sky-100 text-sky-700" },
  details_updated: { label: "Details Updated", color: "bg-blue-100 text-blue-700" },
};

function formatActivityTime(dateStr: string) {
  const d = new Date(dateStr.replace(" ", "T") + "Z");
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function ActivityTab({ property }: { property: PropertyData }) {
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
                <div className="flex flex-col items-center pt-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                  {i < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
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

// ── Reviews Tab ──
function ReviewsTab({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useQuery<{ reviews: any[]; total: number; avgRating: string }>({
    queryKey: [`/public/properties/${propertyId}/reviews`],
    queryFn: () => api.get(`/public/properties/${propertyId}/reviews?limit=50`),
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
            <div key={r.id} className="border rounded-lg p-4">
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
              {r.pmResponse && (
                <div className="mt-3 bg-muted/50 rounded p-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">PM Response</p>
                  <p className="mt-0.5">{r.pmResponse}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
