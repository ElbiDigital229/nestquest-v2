import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ArrowLeft, Loader2, MapPin, CalendarDays } from "lucide-react";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReviewPage({ bookingId }: { bookingId: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: booking, isLoading } = useQuery<any>({
    queryKey: ["/bookings", bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`),
  });

  const { data: existingReview } = useQuery<any>({
    queryKey: ["/bookings", bookingId, "review"],
    queryFn: () => api.get(`/bookings/${bookingId}/review`).catch(() => null),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/review`, { rating, title, description }),
    onSuccess: () => {
      toast({ title: "Review submitted! Thank you." });
      navigate("/portal/my-bookings");
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const displayRating = hoverRating || rating;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/portal/my-bookings")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to My Bookings
      </Button>

      <h1 className="text-2xl font-bold">Leave a Review</h1>

      {/* Booking Summary */}
      {booking && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold">{booking.propertyName}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" /> {booking.propertyCity}
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <CalendarDays className="h-3 w-3" /> {formatDate(booking.checkInDate)} – {formatDate(booking.checkOutDate)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Already reviewed */}
      {existingReview && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Your Review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={`h-6 w-6 ${i <= existingReview.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
              ))}
            </div>
            {existingReview.title && <p className="font-semibold">{existingReview.title}</p>}
            {existingReview.description && <p className="text-sm text-muted-foreground">{existingReview.description}</p>}
            <p className="text-xs text-muted-foreground">Submitted {formatDate(existingReview.created_at || existingReview.createdAt)}</p>
          </CardContent>
        </Card>
      )}

      {/* Review Form */}
      {!existingReview && (
        <Card>
          <CardHeader><CardTitle className="text-lg">How was your stay?</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* Star Rating */}
            <div>
              <Label className="mb-2 block">Rating <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <button
                    key={i}
                    type="button"
                    className="transition-transform hover:scale-110"
                    onMouseEnter={() => setHoverRating(i)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(i)}
                  >
                    <Star className={`h-10 w-10 ${i <= displayRating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                  </button>
                ))}
              </div>
              {displayRating > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][displayRating]}
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title (optional)</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Summarize your experience" />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Your Review (optional)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell others about your stay..." rows={4} />
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!rating || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Review
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
