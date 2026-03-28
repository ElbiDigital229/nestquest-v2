import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import PublicLayout from "@/components/layout/public-layout";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Star,
  Bed,
  Bath,
  Users,
  Maximize,
  Wifi,
  Waves,
  Dumbbell,
  Car,
  Snowflake,
  WashingMachine,
  CookingPot,
  Tv,
  Fence,
  Umbrella,
  ConciergeBell,
  Flame,
  MapPin,
  Clock,
  Shield,
  CreditCard,
  ChevronDown,
  Images,
  MessageSquare,
  Home,
  Building,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

// Fix default marker icon for bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ── Types ──────────────────────────────────────────────────

interface PropertyPhoto {
  id: string;
  url: string;
  displayOrder: number;
  isCover: boolean;
}

interface PropertyPolicy {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
}

interface PropertyDetail {
  id: string;
  publicName: string;
  propertyType: string;
  status: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  unitNumber: string | null;
  floorNumber: number | null;
  buildingName: string | null;
  areaSqft: number | null;
  viewType: string | null;
  maidRoom: boolean;
  furnished: string | null;
  smartHome: boolean;
  ceilingHeight: number | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  parkingSpaces: number;
  parkingType: string | null;
  accessType: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  nightlyRate: string;
  weekendRate: string | null;
  minimumStay: number;
  cleaningFee: string | null;
  securityDepositRequired: boolean;
  securityDepositAmount: string | null;
  acceptedPaymentMethods: string[];
  checkInTime: string | null;
  checkOutTime: string | null;
  cancellationPolicy: string | null;
  areaName: string | null;
  pmName: string | null;
  photos: PropertyPhoto[];
  amenities: string[];
  policies: PropertyPolicy[];
  avgRating: number;
  reviewCount: number;
}

interface AvailabilityData {
  booked: { checkIn: string; checkOut: string; status: string }[];
  blocked: { startDate: string; endDate: string; reason: string }[];
  minimumStay: number;
}

interface Review {
  id: string;
  rating: number;
  title: string;
  description: string;
  pmResponse: string | null;
  pmRespondedAt: string | null;
  createdAt: string;
  guestName: string;
}

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  avgRating: number;
  page: number;
  totalPages: number;
}

interface PriceBreakdown {
  weekdayNights: number;
  weekendNights: number;
  totalNights: number;
  nightlyRate: string;
  weekendRate: string;
  subtotal: string;
  cleaningFee: string;
  tourismTax: string;
  vat: string;
  securityDeposit: string;
  total: string;
  minimumStay: number;
}

// ── Amenity mapping ────────────────────────────────────────

const AMENITY_MAP: Record<string, { label: string; icon: React.ElementType }> = {
  wifi: { label: "WiFi", icon: Wifi },
  pool: { label: "Pool", icon: Waves },
  gym: { label: "Gym", icon: Dumbbell },
  parking: { label: "Parking", icon: Car },
  ac: { label: "A/C", icon: Snowflake },
  washer: { label: "Washer", icon: WashingMachine },
  kitchen: { label: "Kitchen", icon: CookingPot },
  tv: { label: "TV", icon: Tv },
  balcony: { label: "Balcony", icon: Fence },
  beach_access: { label: "Beach Access", icon: Umbrella },
  concierge: { label: "Concierge", icon: ConciergeBell },
  bbq: { label: "BBQ", icon: Flame },
};

function getAmenityInfo(key: string) {
  if (AMENITY_MAP[key]) return AMENITY_MAP[key];
  return {
    label: key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: Home,
  };
}

// ── Helpers ────────────────────────────────────────────────

function renderStars(rating: number, size = 16) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-[${size}px] w-[${size}px] ${
            i <= Math.round(rating)
              ? "text-yellow-500 fill-yellow-500"
              : "text-muted-foreground"
          }`}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

function formatCurrency(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `AED ${num.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function datesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 < end2 && start2 < end1;
}

// ── Component ──────────────────────────────────────────────

export default function PropertyDetailPage() {
  const [, navigate] = useLocation();
  const [match, routeParams] = useRoute("/property/:id");
  const search = useSearch();
  const { user } = useAuth();

  const propertyId = routeParams?.id;
  const searchParams = new URLSearchParams(search);

  // State
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [availability, setAvailability] = useState<AvailabilityData | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsMeta, setReviewsMeta] = useState<{
    total: number;
    avgRating: number;
    page: number;
    totalPages: number;
  } | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") || "");
  const [guests, setGuests] = useState(
    parseInt(searchParams.get("guests") || "1", 10)
  );

  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const [datesUnavailable, setDatesUnavailable] = useState(false);
  const [minimumStayWarning, setMinimumStayWarning] = useState(false);

  const [galleryOpen, setGalleryOpen] = useState(false);

  // ── Fetch property ────────────────────────────────────────

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    api
      .get<PropertyDetail>(`/public/properties/${propertyId}`)
      .then((data) => {
        setProperty(data);
        setError(null);
      })
      .catch((err) => setError(err.message || "Failed to load property"))
      .finally(() => setLoading(false));
  }, [propertyId]);

  // ── Fetch availability ────────────────────────────────────

  useEffect(() => {
    if (!propertyId) return;
    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
    api
      .get<AvailabilityData>(
        `/public/properties/${propertyId}/availability?from=${today}&to=${future}`
      )
      .then(setAvailability)
      .catch(() => {});
  }, [propertyId]);

  // ── Fetch reviews ─────────────────────────────────────────

  const fetchReviews = useCallback(
    (page: number) => {
      if (!propertyId) return;
      setReviewsLoading(true);
      api
        .get<ReviewsResponse>(
          `/public/properties/${propertyId}/reviews?page=${page}&limit=5`
        )
        .then((data) => {
          setReviews((prev) =>
            page === 1 ? data.reviews : [...prev, ...data.reviews]
          );
          setReviewsMeta({
            total: data.total,
            avgRating: data.avgRating,
            page: data.page,
            totalPages: data.totalPages,
          });
        })
        .catch(() => {})
        .finally(() => setReviewsLoading(false));
    },
    [propertyId]
  );

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  // ── Check availability on date change ─────────────────────

  useEffect(() => {
    if (!checkIn || !checkOut || !availability) {
      setDatesUnavailable(false);
      setMinimumStayWarning(false);
      return;
    }

    const hasConflict =
      availability.booked.some((b) =>
        datesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)
      ) ||
      availability.blocked.some((b) =>
        datesOverlap(checkIn, checkOut, b.startDate, b.endDate)
      );

    setDatesUnavailable(hasConflict);

    const nights = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
    );
    setMinimumStayWarning(nights > 0 && nights < availability.minimumStay);
  }, [checkIn, checkOut, availability]);

  // ── Calculate price ───────────────────────────────────────

  useEffect(() => {
    if (!propertyId || !checkIn || !checkOut || datesUnavailable) {
      setPriceBreakdown(null);
      return;
    }
    const nights = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
    );
    if (nights <= 0) {
      setPriceBreakdown(null);
      return;
    }

    setPriceLoading(true);
    api
      .post<PriceBreakdown>("/bookings/calculate-price", {
        propertyId,
        checkIn,
        checkOut,
      })
      .then(setPriceBreakdown)
      .catch(() => setPriceBreakdown(null))
      .finally(() => setPriceLoading(false));
  }, [propertyId, checkIn, checkOut, datesUnavailable]);

  // ── Handlers ──────────────────────────────────────────────

  function handleBookNow() {
    if (!propertyId || !checkIn || !checkOut) return;

    const bookingParams = new URLSearchParams({
      propertyId,
      checkIn,
      checkOut,
      guests: guests.toString(),
    });

    if (user) {
      navigate(`/booking/confirm?${bookingParams.toString()}`);
    } else {
      const returnTo = `/property/${propertyId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;
      navigate(`/login/guest?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }

  // ── Photos ────────────────────────────────────────────────

  const sortedPhotos = property
    ? [...property.photos].sort((a, b) => {
        if (a.isCover && !b.isCover) return -1;
        if (!a.isCover && b.isCover) return 1;
        return a.displayOrder - b.displayOrder;
      })
    : [];

  const coverPhoto = sortedPhotos[0];
  const sidePhotos = sortedPhotos.slice(1, 5);
  const extraPhotosCount = Math.max(0, sortedPhotos.length - 5);

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <PublicLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="w-full h-[400px] rounded-xl mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div>
              <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (error || !property) {
    return (
      <PublicLayout>
        <div className="container max-w-7xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Property Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || "The property you're looking for doesn't exist."}
          </p>
          <Button onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </PublicLayout>
    );
  }

  const hasWeekendRate =
    property.weekendRate &&
    property.weekendRate !== property.nightlyRate;

  return (
    <PublicLayout>
      <div className="container max-w-7xl mx-auto px-4 py-6">
        {/* ── Photo Gallery ──────────────────────────────── */}
        <div className="mb-8">
          {sortedPhotos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-xl overflow-hidden max-h-[460px]">
              {/* Cover photo */}
              <div className="md:col-span-2 md:row-span-2 relative">
                <img
                  src={coverPhoto.url}
                  alt={property.publicName}
                  className="w-full h-full object-cover min-h-[280px] md:min-h-[460px]"
                />
              </div>
              {/* Side photos */}
              {sidePhotos.map((photo, idx) => (
                <div key={photo.id} className="relative hidden md:block">
                  <img
                    src={photo.url}
                    alt={`${property.publicName} ${idx + 2}`}
                    className="w-full h-[228px] object-cover"
                  />
                  {/* "+N more" overlay on last side photo */}
                  {idx === sidePhotos.length - 1 && extraPhotosCount > 0 && (
                    <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
                      <DialogTrigger asChild>
                        <button className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-semibold text-lg hover:bg-black/60 transition-colors">
                          <Images className="h-5 w-5 mr-2" />+
                          {extraPhotosCount} more
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>All Photos</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                          {sortedPhotos.map((p) => (
                            <img
                              key={p.id}
                              src={p.url}
                              alt={property.publicName}
                              className="w-full h-48 object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              ))}
              {/* Show all photos button on mobile or when no side photos */}
              {sortedPhotos.length > 1 && (
                <div className="md:hidden mt-2">
                  <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Images className="h-4 w-4 mr-2" />
                        View all {sortedPhotos.length} photos
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>All Photos</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        {sortedPhotos.map((p) => (
                          <img
                            key={p.id}
                            src={p.url}
                            alt={property.publicName}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-[300px] bg-muted rounded-xl flex items-center justify-center">
              <Building className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* ── Two-column layout ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left column (Property Info) ───────────────── */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title + type + rating */}
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">
                  {property.publicName}
                </h1>
                <Badge variant="secondary" className="capitalize">
                  {property.propertyType.replace(/_/g, " ")}
                </Badge>
              </div>
              {property.areaName && (
                <p className="text-muted-foreground flex items-center gap-1 mb-3">
                  <MapPin className="h-4 w-4" />
                  {property.areaName}, {property.city}
                </p>
              )}
              {property.reviewCount > 0 && (
                <div className="flex items-center gap-2">
                  {renderStars(property.avgRating)}
                  <span className="font-semibold">
                    {property.avgRating.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">
                    ({property.reviewCount}{" "}
                    {property.reviewCount === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2 text-sm">
                <Bed className="h-5 w-5 text-muted-foreground" />
                <span>
                  {property.bedrooms}{" "}
                  {property.bedrooms === 1 ? "Bedroom" : "Bedrooms"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Bath className="h-5 w-5 text-muted-foreground" />
                <span>
                  {property.bathrooms}{" "}
                  {property.bathrooms === 1 ? "Bathroom" : "Bathrooms"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span>Up to {property.maxGuests} guests</span>
              </div>
              {property.areaSqft && (
                <div className="flex items-center gap-2 text-sm">
                  <Maximize className="h-5 w-5 text-muted-foreground" />
                  <span>{property.areaSqft.toLocaleString()} sqft</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Short description */}
            {property.shortDescription && (
              <p className="text-muted-foreground leading-relaxed">
                {property.shortDescription}
              </p>
            )}

            {/* Long description */}
            {property.longDescription && (
              <div>
                <h2 className="text-xl font-semibold mb-3">About this property</h2>
                {property.longDescription.includes("<") ? (
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{
                      __html: property.longDescription,
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                    {property.longDescription}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Amenities */}
            {property.amenities.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Amenities</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {property.amenities.map((key) => {
                    const { label, icon: Icon } = getAmenityInfo(key);
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 text-sm"
                      >
                        <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Additional property details */}
            {(property.viewType ||
              property.furnished ||
              property.maidRoom ||
              property.smartHome ||
              property.parkingSpaces > 0) && (
              <>
                <Separator />
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    Property Details
                  </h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {property.viewType && (
                      <div>
                        <span className="text-muted-foreground">View: </span>
                        <span className="capitalize">
                          {property.viewType.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}
                    {property.furnished && (
                      <div>
                        <span className="text-muted-foreground">
                          Furnished:{" "}
                        </span>
                        <span className="capitalize">{property.furnished}</span>
                      </div>
                    )}
                    {property.maidRoom && (
                      <div>
                        <span className="text-muted-foreground">
                          Maid Room:{" "}
                        </span>
                        <span>Yes</span>
                      </div>
                    )}
                    {property.smartHome && (
                      <div>
                        <span className="text-muted-foreground">
                          Smart Home:{" "}
                        </span>
                        <span>Yes</span>
                      </div>
                    )}
                    {property.parkingSpaces > 0 && (
                      <div>
                        <span className="text-muted-foreground">
                          Parking:{" "}
                        </span>
                        <span>
                          {property.parkingSpaces} space
                          {property.parkingSpaces > 1 ? "s" : ""}
                          {property.parkingType
                            ? ` (${property.parkingType})`
                            : ""}
                        </span>
                      </div>
                    )}
                    {property.ceilingHeight && (
                      <div>
                        <span className="text-muted-foreground">
                          Ceiling Height:{" "}
                        </span>
                        <span>{property.ceilingHeight}m</span>
                      </div>
                    )}
                    {property.buildingName && (
                      <div>
                        <span className="text-muted-foreground">
                          Building:{" "}
                        </span>
                        <span>{property.buildingName}</span>
                      </div>
                    )}
                    {property.floorNumber !== null && (
                      <div>
                        <span className="text-muted-foreground">Floor: </span>
                        <span>{property.floorNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* House Rules / Policies */}
            {property.policies.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    House Rules & Policies
                  </h2>
                  <div className="space-y-4">
                    {[...property.policies]
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((policy) => (
                        <div key={policy.id}>
                          <h3 className="font-medium mb-1">{policy.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {policy.description}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Reviews */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                Reviews
                {reviewsMeta && reviewsMeta.total > 0 && (
                  <span className="text-base font-normal text-muted-foreground">
                    ({reviewsMeta.total})
                  </span>
                )}
              </h2>

              {reviewsMeta && reviewsMeta.total > 0 && (
                <div className="flex items-center gap-3 mb-6">
                  {renderStars(reviewsMeta.avgRating, 20)}
                  <span className="text-2xl font-bold">
                    {reviewsMeta.avgRating.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">
                    based on {reviewsMeta.total}{" "}
                    {reviewsMeta.total === 1 ? "review" : "reviews"}
                  </span>
                </div>
              )}

              {reviews.length === 0 && !reviewsLoading && (
                <p className="text-muted-foreground">No reviews yet.</p>
              )}

              <div className="space-y-4">
                {reviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{review.guestName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              }
                            )}
                          </p>
                        </div>
                        {renderStars(review.rating, 14)}
                      </div>
                      {review.title && (
                        <h4 className="font-medium mb-1">{review.title}</h4>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {review.description}
                      </p>
                      {review.pmResponse && (
                        <div className="mt-3 pl-4 border-l-2 border-primary/30">
                          <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Property Manager Response
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {review.pmResponse}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {reviewsMeta &&
                reviewsMeta.page < reviewsMeta.totalPages && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => fetchReviews(reviewsMeta.page + 1)}
                    disabled={reviewsLoading}
                  >
                    {reviewsLoading ? "Loading..." : "Load More Reviews"}
                    {!reviewsLoading && (
                      <ChevronDown className="h-4 w-4 ml-2" />
                    )}
                  </Button>
                )}
            </div>
          </div>

          {/* ── Right column (Booking Widget) ────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card>
                <CardContent className="pt-6 space-y-5">
                  {/* Price */}
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">
                        {formatCurrency(property.nightlyRate)}
                      </span>
                      <span className="text-muted-foreground">/ night</span>
                    </div>
                    {hasWeekendRate && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Weekend rate:{" "}
                        {formatCurrency(property.weekendRate!)} / night
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Date inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Check-in
                      </label>
                      <Input
                        type="date"
                        value={checkIn}
                        onChange={(e) => setCheckIn(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Check-out
                      </label>
                      <Input
                        type="date"
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        min={checkIn || new Date().toISOString().split("T")[0]}
                      />
                    </div>
                  </div>

                  {/* Guests */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Guests
                    </label>
                    <Input
                      type="number"
                      value={guests}
                      onChange={(e) =>
                        setGuests(
                          Math.max(
                            1,
                            Math.min(
                              property.maxGuests,
                              parseInt(e.target.value, 10) || 1
                            )
                          )
                        )
                      }
                      min={1}
                      max={property.maxGuests}
                    />
                  </div>

                  {/* Availability warning */}
                  {datesUnavailable && (
                    <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md font-medium">
                      These dates are not available.
                    </div>
                  )}

                  {/* Minimum stay warning */}
                  {minimumStayWarning && !datesUnavailable && (
                    <div className="bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 text-sm p-3 rounded-md">
                      Minimum stay is{" "}
                      {availability?.minimumStay || property.minimumStay} nights.
                    </div>
                  )}

                  {/* Price breakdown */}
                  {priceLoading && (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  )}

                  {priceBreakdown && !priceLoading && !datesUnavailable && (
                    <div className="space-y-2 text-sm">
                      {priceBreakdown.weekdayNights > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {priceBreakdown.weekdayNights} weekday night
                            {priceBreakdown.weekdayNights > 1 ? "s" : ""} @{" "}
                            {formatCurrency(priceBreakdown.nightlyRate)}
                          </span>
                        </div>
                      )}
                      {priceBreakdown.weekendNights > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {priceBreakdown.weekendNights} weekend night
                            {priceBreakdown.weekendNights > 1 ? "s" : ""} @{" "}
                            {formatCurrency(priceBreakdown.weekendRate)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(priceBreakdown.subtotal)}</span>
                      </div>
                      {parseFloat(priceBreakdown.cleaningFee) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Cleaning fee
                          </span>
                          <span>
                            {formatCurrency(priceBreakdown.cleaningFee)}
                          </span>
                        </div>
                      )}
                      {parseFloat(priceBreakdown.tourismTax) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Tourism tax
                          </span>
                          <span>
                            {formatCurrency(priceBreakdown.tourismTax)}
                          </span>
                        </div>
                      )}
                      {parseFloat(priceBreakdown.vat) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">VAT</span>
                          <span>{formatCurrency(priceBreakdown.vat)}</span>
                        </div>
                      )}
                      {parseFloat(priceBreakdown.securityDeposit) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Security deposit{" "}
                            <span className="text-xs">(refundable)</span>
                          </span>
                          <span>
                            {formatCurrency(priceBreakdown.securityDeposit)}
                          </span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-bold text-base">
                        <span>Total</span>
                        <span>{formatCurrency(priceBreakdown.total)}</span>
                      </div>
                    </div>
                  )}

                  {/* Book Now button */}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleBookNow}
                    disabled={
                      !checkIn ||
                      !checkOut ||
                      datesUnavailable ||
                      minimumStayWarning
                    }
                  >
                    {user ? "Book Now" : "Log in to Book"}
                  </Button>

                  <Separator />

                  {/* Extra info */}
                  <div className="space-y-3 text-sm">
                    {property.cancellationPolicy && (
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="capitalize">
                          {property.cancellationPolicy.replace(/_/g, " ")}{" "}
                          cancellation
                        </span>
                      </div>
                    )}

                    {property.acceptedPaymentMethods.length > 0 && (
                      <div className="flex items-start gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1.5">
                          {property.acceptedPaymentMethods.map((method) => (
                            <Badge
                              key={method}
                              variant="outline"
                              className="text-xs capitalize"
                            >
                              {method.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(property.checkInTime || property.checkOutTime) && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>
                          {property.checkInTime &&
                            `Check-in: ${property.checkInTime}`}
                          {property.checkInTime && property.checkOutTime && " / "}
                          {property.checkOutTime &&
                            `Check-out: ${property.checkOutTime}`}
                        </span>
                      </div>
                    )}

                    {property.pmName && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>
                          Managed by{" "}
                          <span className="font-medium">{property.pmName}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* ── Map Section ────────────────────────────────── */}
        {property.latitude && property.longitude && (
          <div className="mt-12 mb-8">
            <h2 className="text-xl font-semibold mb-4">Location</h2>
            <div className="rounded-xl overflow-hidden border h-[350px]">
              <MapContainer
                center={[property.latitude, property.longitude]}
                zoom={15}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[property.latitude, property.longitude]}>
                  <Popup>
                    <strong>{property.publicName}</strong>
                    <br />
                    {property.areaName && `${property.areaName}, `}
                    {property.city}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
