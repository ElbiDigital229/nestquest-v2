import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PublicLayout from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Star,
  Bed,
  Bath,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";

interface Area {
  id: string;
  name: string;
  city: string;
  propertyCount: number;
}

interface FeaturedProperty {
  id: string;
  publicName: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: string;
  weekendRate: string | null;
  cleaningFee: string | null;
  city: string;
  areaName: string | null;
  coverPhoto: string | null;
  avgRating: number;
  reviewCount: number;
}

export default function HomePage() {
  const [, navigate] = useLocation();
  const [areas, setAreas] = useState<Area[]>([]);
  const [featured, setFeatured] = useState<FeaturedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [heroTitle, setHeroTitle] = useState("Find Your Perfect Stay");
  const [heroSubtitle, setHeroSubtitle] = useState("Discover premium short-term rental properties across the UAE");

  // Search form
  const [searchArea, setSearchArea] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Area[]>("/public/areas").catch(() => []),
      api.get<FeaturedProperty[]>("/public/featured").catch(() => []),
      api.get<Record<string, string>>("/public/site-settings").catch(() => ({})),
    ]).then(([areasData, featuredData, settings]) => {
      setAreas(areasData);
      setFeatured(featuredData);
      if (settings.hero_image_url) setHeroImage(settings.hero_image_url);
      if (settings.hero_title) setHeroTitle(settings.hero_title);
      if (settings.hero_subtitle) setHeroSubtitle(settings.hero_subtitle);
      setLoading(false);
    });
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchArea) params.set("city", searchArea);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", guests);
    navigate(`/search?${params.toString()}`);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative min-h-[500px] py-20 md:py-32" style={{ overflow: "visible" }}>
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          {heroImage ? (
            <img
              src={heroImage}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/80 to-primary/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-background/80" />
        </div>
        <div className="container max-w-7xl mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white drop-shadow-lg">
              {heroTitle}
            </h1>
            <p className="text-lg text-white/80 drop-shadow">
              {heroSubtitle}
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto bg-card rounded-xl shadow-lg border p-4 md:p-6 relative z-30">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2 relative">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <MapPin className="h-3 w-3 inline mr-1" />
                  Location
                </label>
                <Input
                  placeholder="Search city or area..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                />
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {searchArea && (
                        <button
                          className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-muted flex items-center gap-2 border-b"
                          onClick={() => { setSearchArea(""); setSearchQuery(""); setDropdownOpen(false); }}
                        >
                          Clear selection
                        </button>
                      )}
                      {areas
                        .filter(a => {
                          const q = searchQuery.toLowerCase();
                          return !q || a.name.toLowerCase().includes(q) || (a.city || "").toLowerCase().includes(q);
                        })
                        .map((a) => (
                          <button
                            key={a.id}
                            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 flex items-center gap-2 transition-colors ${searchArea === (a.city || a.name) ? "bg-primary/10 font-medium" : ""}`}
                            onClick={() => { setSearchArea(a.city || a.name); setSearchQuery(a.name); setDropdownOpen(false); }}
                          >
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div>
                              <p>{a.name}</p>
                              {a.city && <p className="text-xs text-muted-foreground capitalize">{a.city}</p>}
                            </div>
                          </button>
                        ))
                      }
                      {areas.filter(a => {
                        const q = searchQuery.toLowerCase();
                        return !q || a.name.toLowerCase().includes(q) || (a.city || "").toLowerCase().includes(q);
                      }).length === 0 && (
                        <p className="px-3 py-4 text-sm text-muted-foreground text-center">No areas found</p>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Check In
                </label>
                <Input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Check Out
                </label>
                <Input
                  type="date"
                  value={checkOut}
                  min={checkIn || today}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  <Users className="h-3 w-3 inline mr-1" />
                  Guests
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    placeholder="2"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                  />
                  <Button onClick={handleSearch} className="shrink-0">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">Featured Properties</h2>
              <p className="text-muted-foreground mt-1">Handpicked stays for your next getaway</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/search")}>
              View All <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <Skeleton className="h-48 rounded-t-lg" />
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>No properties available yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featured.map((prop) => (
                <PropertyCard key={prop.id} property={prop} onClick={() => navigate(`/property/${prop.id}`)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Areas */}
      {areas.filter((a) => a.propertyCount > 0).length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-8">Browse by Area</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {areas
                .filter((a) => a.propertyCount > 0)
                .map((area) => (
                  <Card
                    key={area.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/search?areaId=${area.id}`)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{area.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {area.propertyCount} {area.propertyCount === 1 ? "property" : "properties"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}

// ── Property Card ────────────────────────────────────────

function PropertyCard({ property, onClick }: { property: FeaturedProperty; onClick: () => void }) {
  const typeLabels: Record<string, string> = {
    apartment: "Apartment",
    villa: "Villa",
    townhouse: "Townhouse",
    penthouse: "Penthouse",
    studio: "Studio",
    hotel_apartment: "Hotel Apt",
  };

  return (
    <Card className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all" onClick={onClick}>
      <div className="relative h-48 bg-muted overflow-hidden">
        {property.coverPhoto ? (
          <img
            src={property.coverPhoto}
            alt={property.publicName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No Photo
          </div>
        )}
        <Badge className="absolute top-3 left-3" variant="secondary">
          {typeLabels[property.propertyType] || property.propertyType}
        </Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold truncate">{property.publicName}</h3>
        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
          <MapPin className="h-3 w-3" />
          {property.areaName || property.city}
        </p>
        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{property.bedrooms}</span>
          <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{property.bathrooms}</span>
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{property.maxGuests}</span>
          {property.reviewCount > 0 && (
            <span className="flex items-center gap-1 ml-auto">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              {Number(property.avgRating).toFixed(1)}
              <span className="text-xs">({property.reviewCount})</span>
            </span>
          )}
        </div>
        <div className="mt-3 pt-3 border-t flex items-baseline justify-between">
          <span className="text-lg font-bold">AED {Number(property.nightlyRate).toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">/ night</span>
        </div>
      </CardContent>
    </Card>
  );
}
