import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────

interface StepAmenitiesProps {
  propertyId: string;
  amenities: string[];
  onRefresh: () => void;
}

interface AmenityDef {
  key: string;
  label: string;
}

interface AmenityCategory {
  name: string;
  items: AmenityDef[];
}

// ── Amenity definitions by category ────────────────────────

const AMENITY_CATEGORIES: AmenityCategory[] = [
  {
    name: "Essentials",
    items: [
      { key: "wifi", label: "WiFi" },
      { key: "air_conditioning", label: "Air Conditioning" },
      { key: "tv", label: "TV" },
      { key: "iron", label: "Iron" },
      { key: "hair_dryer", label: "Hair Dryer" },
    ],
  },
  {
    name: "Entertainment",
    items: [
      { key: "swimming_pool", label: "Swimming Pool" },
      { key: "gym", label: "Gym / Fitness Center" },
      { key: "workspace", label: "Workspace / Desk" },
    ],
  },
  {
    name: "Building Features",
    items: [
      { key: "elevator", label: "Elevator" },
      { key: "free_parking", label: "Free Parking" },
      { key: "concierge", label: "Concierge" },
      { key: "doorman", label: "Doorman" },
      { key: "storage_room", label: "Storage Room" },
      { key: "central_gas", label: "Central Gas" },
    ],
  },
  {
    name: "Safety",
    items: [
      { key: "24_7_security", label: "24/7 Security" },
      { key: "cctv", label: "CCTV" },
      { key: "intercom", label: "Intercom" },
    ],
  },
  {
    name: "Outdoor",
    items: [
      { key: "beach_access", label: "Beach Access" },
      { key: "bbq_area", label: "BBQ Area" },
      { key: "garden", label: "Garden" },
      { key: "kids_play_area", label: "Kids Play Area" },
    ],
  },
  {
    name: "Kitchen & Laundry",
    items: [
      { key: "kitchen", label: "Kitchen" },
      { key: "coffee_machine", label: "Coffee Machine" },
      { key: "dishwasher", label: "Dishwasher" },
      { key: "microwave", label: "Microwave" },
      { key: "oven", label: "Oven" },
      { key: "washer", label: "Washer" },
      { key: "dryer", label: "Dryer" },
    ],
  },
  {
    name: "Other",
    items: [
      { key: "pets_allowed", label: "Pets Allowed" },
      { key: "smoking_area", label: "Smoking Area" },
      { key: "housekeeping_available", label: "Housekeeping Available" },
    ],
  },
];

// ── Component ──────────────────────────────────────────────

export default function StepAmenities({
  propertyId,
  amenities,
  onRefresh,
}: StepAmenitiesProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(amenities || []),
  );

  const syncMutation = useMutation({
    mutationFn: (amenityKeys: string[]) =>
      api.put(`/st-properties/${propertyId}/amenities`, {
        amenities: amenityKeys,
      }),
    onSuccess: () => {
      onRefresh();
    },
  });

  const toggleAmenity = useCallback(
    (key: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        // Sync to server
        syncMutation.mutate(Array.from(next));
        return next;
      });
    },
    [syncMutation],
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Select Amenities</h3>
          {syncMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Choose the amenities available at your property.
        </p>
        <Separator className="mb-6" />

        <div className="space-y-6">
          {AMENITY_CATEGORIES.map((category) => (
            <div key={category.name}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {category.name}
              </h4>
              <div className="flex flex-wrap gap-2">
                {category.items.map((amenity) => {
                  const isSelected = selected.has(amenity.key);
                  return (
                    <button
                      key={amenity.key}
                      type="button"
                      onClick={() => toggleAmenity(amenity.key)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-white text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {amenity.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
