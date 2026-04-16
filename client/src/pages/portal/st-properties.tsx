import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PropertyStatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Plus,
  Home,
  Loader2,
  BedDouble,
  Bath,
  Building2,
  MapPin,
  DollarSign,
  Search,
  LayoutGrid,
  List,
  Calendar,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StProperty {
  id: string;
  publicName: string | null;
  propertyType: string | null;
  status: "draft" | "active" | "inactive";
  city: string | null;
  area: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  nightlyRate: string | null;
  coverPhotoUrl: string | null;
  wizardStep: number;
  totalSteps: number;
  photosCount: number;
  createdAt: string;
  updatedAt: string;
  // step completion fields
  maxGuests: number | null;
  addressLine1: string | null;
  shortDescription: string | null;
  cancellationPolicy: string | null;
  poUserId: string | null;
  acquisitionType: string | null;
  agreementConfirmed: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 8;

function getCompletedSteps(p: StProperty): number {
  let count = 0;
  // Step 1: Property Details
  if (p.propertyType && p.bedrooms && p.bathrooms && p.maxGuests && p.addressLine1 && p.city) count++;
  // Step 2: Description
  if (p.publicName && p.shortDescription) count++;
  // Step 3: Photos (1 for indicator)
  if (p.photosCount >= 1) count++;
  // Step 4: Amenities
  if ((p as any).amenitiesCount >= 1) count++;
  // Step 5: Pricing
  if (p.nightlyRate) count++;
  // Step 6: Policies
  if (p.cancellationPolicy) count++;
  // Step 7: Property Owner (with commission)
  if (p.poUserId && (p as any).commissionType && (p as any).commissionValue) count++;
  // Step 8: Agreement Terms (all 4 docs required)
  if (p.acquisitionType && p.agreementConfirmed && (p as any).hasTitle && (p as any).hasSpa && (p as any).hasNoc && (p as any).hasDtcm) count++;
  return count;
}


function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function StProperties() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: properties = [], isLoading } = useQuery<StProperty[]>({
    queryKey: ["/st-properties"],
    queryFn: () => api.get("/st-properties"),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<{ id: string }>("/st-properties"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/st-properties"] });
      navigate(`/portal/st-properties/${data.id}/edit`);
    },
  });

  // Filter properties by search
  const filteredProperties = properties.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.publicName || "").toLowerCase().includes(q) ||
      (p.city || "").toLowerCase().includes(q) ||
      (p.area || "").toLowerCase().includes(q) ||
      (p.propertyType || "").toLowerCase().replace(/_/g, " ").includes(q) ||
      p.status.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Short-Term Properties</h1>
          <p className="text-muted-foreground mt-1">
            Manage your short-term rental listings
          </p>
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Add New ST Property
        </Button>
      </div>

      {/* Search + View Toggle */}
      {properties.length > 0 && (
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, city, area, type..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${
                viewMode === "grid"
                  ? "bg-primary text-white"
                  : "bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-white"
                  : "bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredProperties.length} {filteredProperties.length === 1 ? "property" : "properties"}
          </span>
        </div>
      )}

      {/* Empty state */}
      {properties.length === 0 ? (
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="flex flex-col items-center text-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Home className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No properties yet</h3>
            <p className="text-muted-foreground mb-6">
              Add your first short-term rental property to get started.
            </p>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add New ST Property
            </Button>
          </CardContent>
        </Card>
      ) : filteredProperties.length === 0 ? (
        <div className="text-center py-12">
          <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">
            No properties match "{searchQuery}"
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* ── Grid View ──────────────────────────────────────────── */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((property) => {
            const completed = getCompletedSteps(property);
            const isDraft = property.status === "draft";
            const progressPercent = Math.round((completed / TOTAL_STEPS) * 100);

            return (
              <Card key={property.id} className="overflow-hidden flex flex-col">
                {/* Cover photo */}
                <div className="h-40 bg-muted relative overflow-hidden">
                  {property.coverPhotoUrl ? (
                    <img
                      src={property.coverPhotoUrl}
                      alt={property.publicName || "Property"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                <CardHeader className="pb-2 pt-4 space-y-2">
                  <PropertyStatusBadge status={property.status} className="self-start" />
                  <h3 className="font-semibold text-lg truncate">
                    {property.publicName || "Untitled Property"}
                  </h3>
                </CardHeader>

                <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                  {(property.city || property.area) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {[property.area, property.city].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}

                  {property.propertyType && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="capitalize">{property.propertyType.replace(/_/g, " ")}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    {property.bedrooms != null && (
                      <div className="flex items-center gap-1">
                        <BedDouble className="h-3.5 w-3.5" />
                        <span>{property.bedrooms} bed{property.bedrooms !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                    {property.bathrooms != null && (
                      <div className="flex items-center gap-1">
                        <Bath className="h-3.5 w-3.5" />
                        <span>{property.bathrooms} bath{property.bathrooms !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>

                  {property.nightlyRate && (
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>AED {property.nightlyRate}/night</span>
                    </div>
                  )}

                  {/* Wizard progress — hide if complete */}
                  {progressPercent < 100 && (
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Step {completed} of {TOTAL_STEPS}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-0">
                  <Button
                    variant={isDraft ? "default" : "outline"}
                    className="w-full"
                    onClick={() => navigate(
                      isDraft
                        ? `/portal/st-properties/${property.id}/edit`
                        : `/portal/st-properties/${property.id}`
                    )}
                  >
                    {isDraft ? "Continue Editing" : "View"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ── List View ──────────────────────────────────────────── */
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Property</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Location</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Beds / Baths</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Rate</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Progress</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.map((property) => {
                const completed = getCompletedSteps(property);
                const isDraft = property.status === "draft";
                const progressPercent = Math.round((completed / TOTAL_STEPS) * 100);

                return (
                  <tr
                    key={property.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(
                      isDraft
                        ? `/portal/st-properties/${property.id}/edit`
                        : `/portal/st-properties/${property.id}`
                    )}
                  >
                    {/* Property name + photo */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-muted shrink-0 overflow-hidden">
                          {property.coverPhotoUrl ? (
                            <img
                              src={property.coverPhotoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Home className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-sm truncate max-w-[180px]">
                          {property.publicName || "Untitled Property"}
                        </span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground capitalize">
                        {property.propertyType?.replace(/_/g, " ") || "—"}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground truncate max-w-[140px] block">
                        {[property.area, property.city].filter(Boolean).join(", ") || "—"}
                      </span>
                    </td>

                    {/* Beds / Baths */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {property.bedrooms ?? 0} / {property.bathrooms ?? 0}
                      </span>
                    </td>

                    {/* Rate */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm font-medium">
                        {property.nightlyRate ? `AED ${property.nightlyRate}` : "—"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <PropertyStatusBadge status={property.status} className="text-xs" />
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3">
                      {progressPercent < 100 ? (
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{progressPercent}%</span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-green-600">Complete</span>
                      )}
                    </td>

                    {/* Updated */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground text-right block">
                        {property.updatedAt ? formatDate(property.updatedAt) : "—"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <Button
                        variant={isDraft ? "default" : "outline"}
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            isDraft
                              ? `/portal/st-properties/${property.id}/edit`
                              : `/portal/st-properties/${property.id}`
                          );
                        }}
                      >
                        {isDraft ? "Edit" : "View"}
                      </Button>
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
