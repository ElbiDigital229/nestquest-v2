import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, MessageSquare, Building, Loader2 } from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MyReviews() {
  const { user } = useAuth();
  const isPO = user?.role === "PROPERTY_OWNER";

  // PO: fetch their properties, then reviews for each
  // Guest: fetch their own reviews via bookings
  const { data: properties = [] } = useQuery<any[]>({
    queryKey: isPO ? ["/st-properties/po/my-properties"] : ["/st-properties"],
    queryFn: () => isPO
      ? api.get("/st-properties/po/my-properties").catch(() => [])
      : api.get("/st-properties").catch(() => []),
    enabled: !!user,
  });

  const { data: allReviews = [], isLoading } = useQuery<any[]>({
    queryKey: ["/my-reviews", properties.map((p: any) => p.id).join(",")],
    queryFn: async () => {
      const reviews: any[] = [];
      for (const p of properties) {
        try {
          const res = await api.get<{ reviews: any[] }>(`/public/properties/${p.id}/reviews?limit=50`);
          for (const r of res.reviews) {
            reviews.push({ ...r, propertyName: p.publicName || p.public_name || p.name || p.id, propertyId: p.id });
          }
        } catch {}
      }
      return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    enabled: properties.length > 0,
  });

  const totalReviews = allReviews.length;
  const avgRating = totalReviews > 0 ? allReviews.reduce((s, r) => s + r.rating, 0) / totalReviews : 0;
  const ratingDist = [5, 4, 3, 2, 1].map(r => ({
    stars: r,
    count: allReviews.filter(rev => rev.rating === r).length,
  }));

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Star className="h-6 w-6" /> My Reviews
        </h1>
        <p className="text-muted-foreground mt-1">Guest reviews across your properties</p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-6 items-start">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-5xl font-bold">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
            <div className="flex gap-0.5 justify-center mt-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={`h-5 w-5 ${i <= Math.round(avgRating) ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{totalReviews} review{totalReviews !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[200px]">
          <CardContent className="p-6 space-y-2">
            {ratingDist.map(r => (
              <div key={r.stars} className="flex items-center gap-3 text-sm">
                <span className="w-12 text-right">{r.stars} star{r.stars !== 1 ? "s" : ""}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: totalReviews > 0 ? `${(r.count / totalReviews) * 100}%` : "0%" }} />
                </div>
                <span className="w-8 text-muted-foreground">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Reviews */}
      {allReviews.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No reviews yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allReviews.map(review => (
            <Card key={review.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} className={`h-4 w-4 ${i <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                        ))}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        <Building className="h-3 w-3 mr-1" />
                        {review.propertyName}
                      </Badge>
                    </div>
                    {review.title && <p className="font-semibold mb-1">{review.title}</p>}
                    {review.description && <p className="text-sm text-muted-foreground">{review.description}</p>}
                    {review.pmResponse && (
                      <div className="mt-3 bg-muted/50 rounded-lg p-3 text-sm">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">PM Response</p>
                        <p>{review.pmResponse}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">{review.guestName || "Guest"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
