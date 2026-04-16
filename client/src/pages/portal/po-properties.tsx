import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Home, MapPin, Eye } from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  active: { label: "Active", className: "bg-green-600 text-white" },
  inactive: { label: "Inactive", className: "bg-gray-200 text-gray-600" },
};

interface PoProperty {
  id: string;
  name: string | null;
  city: string | null;
  propertyType: string | null;
  status: string;
  acquisitionType: string | null;
  purchasePrice: string | null;
  purchaseDate: string | null;
  coverPhoto: string | null;
  areaName: string | null;
  pmName: string | null;
  createdAt: string;
}

export default function PoProperties() {
  const [, navigate] = useLocation();

  const { data: properties, isLoading } = useQuery<PoProperty[]>({
    queryKey: ["/st-properties/po/my-properties"],
    queryFn: () => api.get("/st-properties/po/my-properties"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Properties</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Properties managed on your behalf. View investment details and track expenses.
        </p>
      </div>

      {!properties || properties.length === 0 ? (
        <div className="text-center py-16 border rounded-lg">
          <Home className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-1">No Properties Yet</h3>
          <p className="text-sm text-muted-foreground">
            Properties assigned to you by your property manager will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => {
            const badge = STATUS_BADGE[p.status] || STATUS_BADGE.draft;
            return (
              <div
                key={p.id}
                className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/portal/po-properties/${p.id}`)}
              >
                {/* Photo */}
                <div className="h-40 bg-muted relative overflow-hidden">
                  {p.coverPhoto ? (
                    <img src={p.coverPhoto} alt={p.name || "Property"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Home className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <Badge className={`absolute top-2 left-2 ${badge.className}`}>{badge.label}</Badge>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold truncate">{p.name || "Untitled Property"}</h3>
                  {(p.areaName || p.city) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {[p.areaName, p.city?.replace(/_/g, " ")].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {p.pmName && (
                    <p className="text-xs text-muted-foreground mt-1">Managed by {p.pmName}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      {p.purchasePrice && (
                        <p className="text-sm font-semibold text-green-700">
                          AED {parseFloat(p.purchasePrice).toLocaleString()}
                        </p>
                      )}
                      {p.acquisitionType && (
                        <Badge variant="secondary" className="text-[10px] mt-1">
                          {p.acquisitionType.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <Button variant="outline" size="sm">
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
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
