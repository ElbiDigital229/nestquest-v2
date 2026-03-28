import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import PublicLayout from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  Star,
  Bed,
  Bath,
  Users,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Map as MapIcon,
  List,
} from "lucide-react";
import { api } from "@/lib/api";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// --- Types ---

interface Area {
  id: string;
  name: string;
  city: string;
  propertyCount: number;
}

interface Property {
  id: string;
  publicName: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: string;
  weekendRate: string | null;
  cleaningFee: string | null;
  minimumStay: number;
  city: string;
  latitude: number | null;
  longitude: number | null;
  areaName: string | null;
  coverPhoto: string | null;
  avgRating: number;
  reviewCount: number;
}

interface SearchResponse {
  properties: Property[];
  total: number;
  page: number;
  totalPages: number;
}

// --- Map helper ---

function FitBounds({ properties }: { properties: Property[] }) {
  const map = useMap();

  useEffect(() => {
    const coords = properties
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => [p.latitude!, p.longitude!] as L.LatLngTuple);

    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [properties, map]);

  return null;
}

// --- Constants ---

const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "townhouse", label: "Townhouse" },
  { value: "penthouse", label: "Penthouse" },
  { value: "studio", label: "Studio" },
  { value: "hotel_apartment", label: "Hotel Apartment" },
];

const SORT_OPTIONS = [
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating_desc", label: "Top Rated" },
];

const LIMIT = 12;

// --- Component ---

export default function SearchPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);

  // Filter state — initialized from URL
  const [areaId, setAreaId] = useState(params.get("areaId") || "");
  const [city, setCity] = useState(params.get("city") || "");
  const [checkIn, setCheckIn] = useState(params.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(params.get("checkOut") || "");
  const [guests, setGuests] = useState(params.get("guests") || "");
  const [minPrice, setMinPrice] = useState(params.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") || "");
  const [propertyType, setPropertyType] = useState(params.get("propertyType") || "");
  const [bedrooms, setBedrooms] = useState(params.get("bedrooms") || "");
  const [sort, setSort] = useState(params.get("sort") || "");
  const [page, setPage] = useState(Number(params.get("page")) || 1);

  // Data state
  const [areas, setAreas] = useState<Area[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showMobileMap, setShowMobileMap] = useState(false);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch areas once
  useEffect(() => {
    api.get<Area[]>("/public/areas").then(setAreas).catch(() => {});
  }, []);

  // Build query string from current filters
  const buildQuery = useCallback(() => {
    const q = new URLSearchParams();
    if (areaId) q.set("areaId", areaId);
    if (city) q.set("city", city);
    if (checkIn) q.set("checkIn", checkIn);
    if (checkOut) q.set("checkOut", checkOut);
    if (guests) q.set("guests", guests);
    if (minPrice) q.set("minPrice", minPrice);
    if (maxPrice) q.set("maxPrice", maxPrice);
    if (propertyType) q.set("propertyType", propertyType);
    if (bedrooms) q.set("bedrooms", bedrooms);
    if (sort) q.set("sort", sort);
    q.set("page", String(page));
    q.set("limit", String(LIMIT));
    return q.toString();
  }, [areaId, city, checkIn, checkOut, guests, minPrice, maxPrice, propertyType, bedrooms, sort, page]);

  // Fetch properties
  useEffect(() => {
    setLoading(true);
    const query = buildQuery();
    api
      .get<SearchResponse>(`/public/properties?${query}`)
      .then((data) => {
        setProperties(data.properties);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      })
      .catch(() => {
        setProperties([]);
        setTotal(0);
        setTotalPages(0);
      })
      .finally(() => setLoading(false));
  }, [buildQuery]);

  const handleSearch = () => {
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const goToProperty = (id: string) => {
    const q = new URLSearchParams();
    if (checkIn) q.set("checkIn", checkIn);
    if (checkOut) q.set("checkOut", checkOut);
    if (guests) q.set("guests", guests);
    const qs = q.toString();
    navigate(`/property/${id}${qs ? `?${qs}` : ""}`);
  };

  const handleMarkerClick = (id: string) => {
    setHighlightedId(id);
    const el = cardRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const formatType = (t: string) =>
    PROPERTY_TYPES.find((pt) => pt.value === t)?.label || t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <PublicLayout>
      {/* Filter Bar */}
      <div className="sticky top-16 z-40 bg-background border-b">
        <div className="container max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-end gap-2">
            {/* Location / Area */}
            <div className="w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
              <Select value={areaId} onValueChange={(v) => { setAreaId(v === "__all__" ? "" : v); setCity(""); }}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All areas</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.propertyCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Check-in */}
            <div className="w-[calc(50%-4px)] sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Check-in</label>
              <Input
                type="date"
                value={checkIn}
                min={today}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full sm:w-[150px]"
              />
            </div>

            {/* Check-out */}
            <div className="w-[calc(50%-4px)] sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Check-out</label>
              <Input
                type="date"
                value={checkOut}
                min={checkIn || today}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full sm:w-[150px]"
              />
            </div>

            {/* Guests */}
            <div className="w-[calc(50%-4px)] sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Guests</label>
              <Input
                type="number"
                min={1}
                placeholder="Guests"
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full sm:w-[100px]"
              />
            </div>

            {/* Price range */}
            <div className="w-[calc(50%-4px)] sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Price range</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-[80px]"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-[80px]"
                />
              </div>
            </div>

            {/* Property type */}
            <div className="w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <Select value={propertyType} onValueChange={(v) => setPropertyType(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bedrooms */}
            <div className="w-[calc(50%-4px)] sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bedrooms</label>
              <Input
                type="number"
                min={0}
                placeholder="Min"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full sm:w-[90px]"
              />
            </div>

            {/* Sort */}
            <div className="w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort</label>
              <Select value={sort} onValueChange={(v) => setSort(v === "__default__" ? "" : v)}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default</SelectItem>
                  {SORT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search button */}
            <Button onClick={handleSearch} className="w-full sm:w-auto">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Results info + mobile map toggle */}
      <div className="container max-w-7xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Searching..." : `${total} ${total === 1 ? "property" : "properties"} found`}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setShowMobileMap((v) => !v)}
        >
          {showMobileMap ? (
            <>
              <List className="h-4 w-4 mr-1" /> List
            </>
          ) : (
            <>
              <MapIcon className="h-4 w-4 mr-1" /> Map
            </>
          )}
        </Button>
      </div>

      {/* Main content: list + map */}
      <div className="container max-w-7xl mx-auto px-4 pb-8">
        <div className="flex gap-4">
          {/* Property List */}
          <div
            className={`w-full lg:w-[60%] ${showMobileMap ? "hidden lg:block" : "block"}`}
          >
            {loading ? (
              <div className="grid gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row">
                        <Skeleton className="w-full sm:w-[240px] h-[180px] rounded-l-lg" />
                        <div className="flex-1 p-4 space-y-3">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <div className="flex gap-4">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                          <Skeleton className="h-5 w-24" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : properties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <SlidersHorizontal className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">No properties found</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Try adjusting your search filters or broadening your location to see more results.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4">
                  {properties.map((property) => (
                    <Card
                      key={property.id}
                      ref={(el) => { cardRefs.current[property.id] = el; }}
                      className={`cursor-pointer transition-shadow hover:shadow-md ${
                        highlightedId === property.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => goToProperty(property.id)}
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          {/* Cover photo */}
                          <div className="w-full sm:w-[240px] h-[180px] flex-shrink-0 relative overflow-hidden rounded-t-lg sm:rounded-l-lg sm:rounded-tr-none">
                            {property.coverPhoto ? (
                              <img
                                src={property.coverPhoto}
                                alt={property.publicName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <MapPin className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <Badge className="absolute top-2 left-2 text-xs">
                              {formatType(property.propertyType)}
                            </Badge>
                          </div>

                          {/* Details */}
                          <div className="flex-1 p-4 flex flex-col justify-between">
                            <div>
                              <h3 className="font-semibold text-base line-clamp-1">
                                {property.publicName}
                              </h3>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {property.areaName ? `${property.areaName}, ` : ""}
                                {property.city}
                              </p>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                              <span className="flex items-center gap-1">
                                <Bed className="h-3.5 w-3.5" />
                                {property.bedrooms} {property.bedrooms === 1 ? "bed" : "beds"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Bath className="h-3.5 w-3.5" />
                                {property.bathrooms} {property.bathrooms === 1 ? "bath" : "baths"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {property.maxGuests} {property.maxGuests === 1 ? "guest" : "guests"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-1">
                                {property.reviewCount > 0 ? (
                                  <>
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    <span className="text-sm font-medium">
                                      {Number(property.avgRating).toFixed(1)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({property.reviewCount})
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No reviews</span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-bold">
                                  AED {Number(property.nightlyRate).toLocaleString()}
                                </span>
                                <span className="text-sm text-muted-foreground"> / night</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Map */}
          <div
            className={`lg:w-[40%] lg:block ${
              showMobileMap ? "block w-full" : "hidden"
            }`}
          >
            <div className="sticky top-[140px] h-[calc(100vh-160px)] rounded-lg overflow-hidden border">
              <MapContainer
                center={[25.2048, 55.2708]}
                zoom={11}
                className="h-full w-full"
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds properties={properties} />
                {properties
                  .filter((p) => p.latitude != null && p.longitude != null)
                  .map((property) => (
                    <Marker
                      key={property.id}
                      position={[property.latitude!, property.longitude!]}
                      eventHandlers={{
                        click: () => handleMarkerClick(property.id),
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{property.publicName}</p>
                          <p className="text-muted-foreground">
                            AED {Number(property.nightlyRate).toLocaleString()} / night
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
