import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Home,
  MapPin,
  Car,
  Key,
  Minus,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ── Types ──────────────────────────────────────────────────

interface StepProps {
  property: any;
  onUpdate: (fields: Record<string, any>) => void;
}

interface AreaItem {
  id: string;
  name: string;
  city: string;
  latitude: string | null;
  longitude: string | null;
}

// ── Counter sub-component ──────────────────────────────────

function Counter({
  value,
  min = 0,
  onChange,
}: {
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 bg-white"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-8 text-center font-medium tabular-nums">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 bg-white"
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Map click handler ──────────────────────────────────────

function MapClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { duration: 1 });
  }, [map, lat, lng]);
  return null;
}

// ── Helpers ────────────────────────────────────────────────

const CITY_OPTIONS = [
  { value: "dubai", label: "Dubai" },
  { value: "abu_dhabi", label: "Abu Dhabi" },
  { value: "sharjah", label: "Sharjah" },
  { value: "ajman", label: "Ajman" },
  { value: "ras_al_khaimah", label: "Ras Al Khaimah" },
  { value: "fujairah", label: "Fujairah" },
  { value: "umm_al_quwain", label: "Umm Al Quwain" },
];

const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "office", label: "Office" },
];

const VIEW_TYPES = [
  { value: "sea_view", label: "Sea View" },
  { value: "garden_view", label: "Garden View" },
  { value: "city_view", label: "City View" },
  { value: "pool_view", label: "Pool View" },
  { value: "no_view", label: "No View" },
];

const PARKING_TYPES = [
  { value: "covered", label: "Covered" },
  { value: "basement", label: "Basement" },
  { value: "street", label: "Street" },
];

const ACCESS_TYPES = [
  { value: "traditional_key", label: "Traditional Key" },
  { value: "smart_lock", label: "Smart Lock" },
];

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Main component ─────────────────────────────────────────

export default function StepPropertyDetails({ property, onUpdate }: StepProps) {
  // ── Local state ──────────────────────────────────────────
  const [propertyType, setPropertyType] = useState(property.propertyType || "");
  const [unitNumber, setUnitNumber] = useState(property.unitNumber || "");
  const [floorNumber, setFloorNumber] = useState(property.floorNumber ?? "");
  const [buildingName, setBuildingName] = useState(property.buildingName || "");
  const [areaSqft, setAreaSqft] = useState(property.areaSqft ?? "");
  const [bedrooms, setBedrooms] = useState(property.bedrooms ?? 0);
  const [bathrooms, setBathrooms] = useState(property.bathrooms ?? 0);
  const [maxGuests, setMaxGuests] = useState(property.maxGuests ?? 1);
  const [maidRoom, setMaidRoom] = useState(property.maidRoom ?? false);
  const [furnished, setFurnished] = useState(property.furnished ?? false);
  const [ceilingHeight, setCeilingHeight] = useState(property.ceilingHeight ?? "");
  const [viewType, setViewType] = useState(property.viewType || "");
  const [smartHome, setSmartHome] = useState(property.smartHome ?? false);

  // Address
  const [addressLine1, setAddressLine1] = useState(property.addressLine1 || "");
  const [addressLine2, setAddressLine2] = useState(property.addressLine2 || "");
  const [city, setCity] = useState(property.city || "");
  const [zipCode, setZipCode] = useState(property.zipCode || "");
  const [latitude, setLatitude] = useState(property.latitude || "");
  const [longitude, setLongitude] = useState(property.longitude || "");
  const [areaId, setAreaId] = useState(property.areaId || "");
  const [mapSearch, setMapSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [recenterTo, setRecenterTo] = useState<{ lat: number; lng: number } | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSearchResults = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`
      );
      const data = await res.json();
      setSearchResults(data);
      setShowResults(data.length > 0);
    } catch {
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleMapSearchChange = (value: string) => {
    setMapSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSearchResults(value), 300);
  };

  const handleSelectResult = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    setLatitude(latStr);
    setLongitude(lngStr);
    onUpdate({ latitude: latStr, longitude: lngStr });
    setRecenterTo({ lat, lng });
    setMapSearch(result.display_name);
    setShowResults(false);
    setSearchResults([]);
  };

  const handleLocationSearch = async () => {
    const q = mapSearch.trim();
    if (!q) return;
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`
      );
      const data = await res.json();
      if (data.length === 1) {
        handleSelectResult(data[0]);
      } else if (data.length > 1) {
        setSearchResults(data);
        setShowResults(true);
      }
    } catch {
      // Silently fail — user can still click the map
    } finally {
      setSearchLoading(false);
    }
  };

  // Parking
  const [parkingSpaces, setParkingSpaces] = useState(property.parkingSpaces ?? 0);
  const [parkingType, setParkingType] = useState(property.parkingType || "");

  // Access
  const [accessType, setAccessType] = useState(property.accessType || "traditional_key");
  const [lockDeviceId, setLockDeviceId] = useState(property.lockDeviceId || "");

  // Track if we've already initialized from property
  const initialized = useRef(false);

  // Re-sync local state if property changes externally
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    // Only update fields that differ (avoids infinite loops)
  }, [property]);

  // ── Fetch areas ──────────────────────────────────────────
  const { data: areasData } = useQuery<AreaItem[]>({
    queryKey: ["/st-properties/areas"],
    queryFn: () => api.get("/st-properties/areas"),
  });

  // Group areas by city
  const areasByCity = (areasData || []).reduce<Record<string, AreaItem[]>>(
    (acc, area) => {
      if (!acc[area.city]) acc[area.city] = [];
      acc[area.city].push(area);
      return acc;
    },
    {},
  );

  // ── Auto-select nearest area when lat/lng changes ────────
  useEffect(() => {
    if (!latitude || !longitude || !areasData?.length) return;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    let closestArea: AreaItem | null = null;
    let closestDist = Infinity;

    for (const area of areasData) {
      if (!area.latitude || !area.longitude) continue;
      const dist = haversineDistance(
        lat,
        lng,
        parseFloat(area.latitude),
        parseFloat(area.longitude),
      );
      if (dist < closestDist) {
        closestDist = dist;
        closestArea = area;
      }
    }

    if (closestArea && closestDist < 30) {
      setAreaId(closestArea.id);
      onUpdate({ areaId: closestArea.id });
    }
  }, [latitude, longitude, areasData]);

  // ── Update helpers (immediate for selects/toggles/counters) ──
  const updateField = useCallback(
    (field: string, value: any) => {
      onUpdate({ [field]: value });
    },
    [onUpdate],
  );

  // For text/number inputs — called onBlur
  const handleBlur = useCallback(
    (field: string, value: any) => {
      onUpdate({ [field]: value === "" ? null : value });
    },
    [onUpdate],
  );

  // ── Map click handler ────────────────────────────────────
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const latStr = lat.toFixed(6);
      const lngStr = lng.toFixed(6);
      setLatitude(latStr);
      setLongitude(lngStr);
      onUpdate({ latitude: latStr, longitude: lngStr });
    },
    [onUpdate],
  );

  // ── Map center ───────────────────────────────────────────
  const mapCenter: [number, number] =
    latitude && longitude
      ? [parseFloat(latitude), parseFloat(longitude)]
      : [25.2, 55.27];
  const mapZoom = latitude && longitude ? 14 : 10;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* ── Basic Information ──────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Home className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Basic Information</h3>
        </div>
        <Separator className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Property Type */}
          <div className="space-y-1.5">
            <Label>
              Property Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={propertyType}
              onValueChange={(v) => {
                setPropertyType(v);
                updateField("propertyType", v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unit Number */}
          <div className="space-y-1.5">
            <Label>Unit Number</Label>
            <Input
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              onBlur={() => handleBlur("unitNumber", unitNumber)}
              placeholder="e.g. 1204"
            />
          </div>

          {/* Floor Number */}
          <div className="space-y-1.5">
            <Label>Floor Number</Label>
            <Input
              type="number"
              value={floorNumber}
              onChange={(e) => setFloorNumber(e.target.value)}
              onBlur={() =>
                handleBlur(
                  "floorNumber",
                  floorNumber === "" ? null : parseInt(floorNumber),
                )
              }
              placeholder="e.g. 12"
            />
          </div>

          {/* Building Name */}
          <div className="space-y-1.5">
            <Label>Building Name</Label>
            <Input
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              onBlur={() => handleBlur("buildingName", buildingName)}
              placeholder="e.g. Marina Heights"
            />
          </div>

          {/* Area in SQFT */}
          <div className="space-y-1.5">
            <Label>Area in SQFT</Label>
            <Input
              type="number"
              value={areaSqft}
              onChange={(e) => setAreaSqft(e.target.value)}
              onBlur={() =>
                handleBlur(
                  "areaSqft",
                  areaSqft === "" ? null : parseInt(areaSqft),
                )
              }
              placeholder="e.g. 1200"
            />
          </div>

          {/* View Type */}
          <div className="space-y-1.5">
            <Label>View Type</Label>
            <Select
              value={viewType}
              onValueChange={(v) => {
                setViewType(v);
                updateField("viewType", v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                {VIEW_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bedrooms */}
          <div className="space-y-1.5">
            <Label>Bedrooms</Label>
            <Counter
              value={bedrooms}
              min={0}
              onChange={(v) => {
                setBedrooms(v);
                updateField("bedrooms", v);
              }}
            />
          </div>

          {/* Bathrooms */}
          <div className="space-y-1.5">
            <Label>Bathrooms</Label>
            <Counter
              value={bathrooms}
              min={0}
              onChange={(v) => {
                setBathrooms(v);
                updateField("bathrooms", v);
              }}
            />
          </div>

          {/* Max Guests */}
          <div className="space-y-1.5">
            <Label>Max Guests</Label>
            <Counter
              value={maxGuests}
              min={1}
              onChange={(v) => {
                setMaxGuests(v);
                updateField("maxGuests", v);
              }}
            />
          </div>

          {/* Ceiling Height */}
          <div className="space-y-1.5">
            <Label>Ceiling Height (CM)</Label>
            <Input
              type="number"
              value={ceilingHeight}
              onChange={(e) => setCeilingHeight(e.target.value)}
              onBlur={() =>
                handleBlur(
                  "ceilingHeight",
                  ceilingHeight === "" ? null : parseInt(ceilingHeight),
                )
              }
              placeholder="e.g. 300"
            />
          </div>

          {/* Maid Room */}
          <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2.5">
            <Label className="cursor-pointer">Maid Room</Label>
            <Switch
              checked={maidRoom}
              onCheckedChange={(v) => {
                setMaidRoom(v);
                updateField("maidRoom", v);
              }}
            />
          </div>

          {/* Furnished */}
          <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2.5">
            <Label className="cursor-pointer">Furnished</Label>
            <Switch
              checked={furnished}
              onCheckedChange={(v) => {
                setFurnished(v);
                updateField("furnished", v);
              }}
            />
          </div>

          {/* Smart Home */}
          <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2.5">
            <Label className="cursor-pointer">Smart Home</Label>
            <Switch
              checked={smartHome}
              onCheckedChange={(v) => {
                setSmartHome(v);
                updateField("smartHome", v);
              }}
            />
          </div>
        </div>
      </section>

      {/* ── Address ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Address</h3>
        </div>
        <Separator className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Address Line 1 */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>
              Address Line 1 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              onBlur={() => handleBlur("addressLine1", addressLine1)}
              placeholder="Street address"
            />
          </div>

          {/* Address Line 2 */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>Address Line 2</Label>
            <Input
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              onBlur={() => handleBlur("addressLine2", addressLine2)}
              placeholder="Apartment, suite, etc."
            />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label>
              City <span className="text-destructive">*</span>
            </Label>
            <Select
              value={city}
              onValueChange={(v) => {
                setCity(v);
                updateField("city", v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {CITY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ZIP Code */}
          <div className="space-y-1.5">
            <Label>ZIP Code</Label>
            <Input
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              onBlur={() => handleBlur("zipCode", zipCode)}
              placeholder="e.g. 00000"
            />
          </div>
        </div>

        {/* Property Location — Map */}
        <div className="mt-4 space-y-3">
          <Label>Property Location</Label>
          <div ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={mapSearch}
                onChange={(e) => handleMapSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                placeholder="Search for an address or area..."
                className="pl-10 pr-10"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-[2000] top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-[240px] overflow-y-auto">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground truncate"
                      onClick={() => handleSelectResult(result)}
                    >
                      {result.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="h-[300px] rounded-md overflow-hidden border">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              className="h-full w-full"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler onClick={handleMapClick} />
              {recenterTo && (
                <MapRecenter lat={recenterTo.lat} lng={recenterTo.lng} />
              )}
              {latitude && longitude && (
                <Marker
                  position={[parseFloat(latitude), parseFloat(longitude)]}
                />
              )}
            </MapContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Latitude</Label>
              <Input
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                onBlur={() => handleBlur("latitude", latitude)}
                placeholder="25.2048"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Longitude</Label>
              <Input
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                onBlur={() => handleBlur("longitude", longitude)}
                placeholder="55.2708"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Area</Label>
              <Select
                value={areaId}
                onValueChange={(v) => {
                  setAreaId(v);
                  updateField("areaId", v);
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(areasByCity).map(([cityKey, cityAreas]) => {
                    const cityLabel =
                      CITY_OPTIONS.find((c) => c.value === cityKey)?.label ||
                      cityKey;
                    return (
                      <SelectGroup key={cityKey}>
                        <SelectLabel>{cityLabel}</SelectLabel>
                        {cityAreas.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* ── Parking ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Car className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Parking</h3>
        </div>
        <Separator className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div className="space-y-1.5">
            <Label>Parking Spaces</Label>
            <Counter
              value={parkingSpaces}
              min={0}
              onChange={(v) => {
                setParkingSpaces(v);
                updateField("parkingSpaces", v);
                if (v === 0) {
                  setParkingType("");
                  updateField("parkingType", null);
                }
              }}
            />
          </div>

          {parkingSpaces > 0 && (
            <div className="space-y-1.5">
              <Label>Parking Type</Label>
              <Select
                value={parkingType}
                onValueChange={(v) => {
                  setParkingType(v);
                  updateField("parkingType", v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parking type" />
                </SelectTrigger>
                <SelectContent>
                  {PARKING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>

      {/* ── Access & Entry ─────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Key className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Access & Entry</h3>
        </div>
        <Separator className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div className="space-y-1.5">
            <Label>Access Type</Label>
            <Select
              value={accessType}
              onValueChange={(v) => {
                setAccessType(v);
                updateField("accessType", v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select access type" />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {accessType === "smart_lock" && (
            <SmartLockSelector
              propertyId={property.id}
              lockDeviceId={lockDeviceId}
              onSelect={(v) => { setLockDeviceId(v); updateField("lockDeviceId", v); }}
            />
          )}
        </div>
      </section>
    </div>
  );
}

// ── Smart Lock Selector ──
function SmartLockSelector({ propertyId, lockDeviceId, onSelect }: { propertyId: string; lockDeviceId: string; onSelect: (v: string) => void }) {
  const { data: locks = [] } = useQuery<any[]>({
    queryKey: [`/st-properties/${propertyId}/locks`],
    queryFn: () => api.get(`/st-properties/${propertyId}/locks`).catch(() => []),
    enabled: !!propertyId,
  });

  const activeLocks = locks.filter((l: any) => l.isActive);

  if (activeLocks.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label>Lock Device ID <span className="text-destructive">*</span></Label>
        <Input
          value={lockDeviceId}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="Enter device ID"
        />
        <p className="text-xs text-muted-foreground">
          No smart locks configured. Add locks via the Smart Locks tab, or enter a device ID manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Smart Lock <span className="text-destructive">*</span></Label>
      <Select
        value={lockDeviceId}
        onValueChange={onSelect}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a smart lock..." />
        </SelectTrigger>
        <SelectContent>
          {activeLocks.map((lock: any) => (
            <SelectItem key={lock.deviceId || lock.id} value={lock.deviceId || lock.id}>
              {lock.name} {lock.brand ? `(${lock.brand})` : ""} — {lock.location || "No location"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {activeLocks.length} lock(s) available. Manage locks in the Smart Locks tab.
      </p>
    </div>
  );
}
