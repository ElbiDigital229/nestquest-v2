import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, MessageSquare, Building2, Loader2, TrendingUp } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  description: string | null;
  pmResponse: string | null;
  pmRespondedAt: string | null;
  createdAt: string;
  guestName: string;
  propertyName: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
}

interface ReviewsData {
  reviews: Review[];
  summary: {
    total: number;
    avgRating: string | null;
    byRating: { stars: number; count: number }[];
  };
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PoReviews() {
  const { data, isLoading } = useQuery<ReviewsData>({
    queryKey: ["/st-properties/po-reviews"],
    queryFn: () => api.get("/st-properties/po-reviews"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { reviews = [], summary } = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Star className="h-6 w-6" /> Guest Reviews
        </h1>
        <p className="text-muted-foreground mt-1">Reviews left by guests who stayed at your properties</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-amber-50">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Average Rating</p>
              <p className="text-2xl font-bold text-amber-700">{summary?.avgRating ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-blue-50">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Reviews</p>
              <p className="text-2xl font-bold text-blue-700">{summary?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            {summary?.byRating.map(({ stars, count }) => (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-right font-medium">{stars}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: summary.total > 0 ? `${(count / summary.total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="w-4 text-muted-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Review list */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No reviews yet</p>
            <p className="text-sm mt-1">Reviews will appear here once guests complete their stays</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="space-y-1">
                    <StarRow rating={r.rating} />
                    {r.title && <p className="font-semibold">{r.title}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground justify-end">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{r.propertyName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{r.guestName}</span>
                  {" · "}
                  {formatDate(r.checkInDate)} – {formatDate(r.checkOutDate)}
                </div>

                {r.description && (
                  <p className="text-sm leading-relaxed">{r.description}</p>
                )}

                {r.pmResponse && (
                  <>
                    <Separator />
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">Property Manager Response</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(r.pmRespondedAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground italic">"{r.pmResponse}"</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
