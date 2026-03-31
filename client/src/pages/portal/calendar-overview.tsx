import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, ChevronLeft, ChevronRight, Building, Loader2 } from "lucide-react";

const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-500",
  confirmed: "bg-blue-500",
  checked_in: "bg-green-500",
  checked_out: "bg-gray-400",
  completed: "bg-gray-400",
};

export default function CalendarOverview() {
  const [, navigate] = useLocation();
  const [viewDays, setViewDays] = useState(30);
  const [startOffset, setStartOffset] = useState(0);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + startOffset);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + viewDays);

  const from = fmtDate(startDate);
  const to = fmtDate(endDate);
  const today = fmtDate(new Date());

  // Get all properties
  const { data: properties = [], isLoading: propsLoading } = useQuery<any[]>({
    queryKey: ["/st-properties"],
    queryFn: () => api.get("/st-properties"),
  });

  // Get calendar data for each property
  const { data: calendarData = {}, isLoading: calLoading } = useQuery<Record<string, any>>({
    queryKey: ["/calendar-overview", from, to, properties.map((p: any) => p.id).join(",")],
    queryFn: async () => {
      const result: Record<string, any> = {};
      for (const p of properties) {
        try {
          const data = await api.get(`/st-properties/${p.id}/calendar-pricing?from=${from}&to=${to}`);
          result[p.id] = data;
        } catch { result[p.id] = { bookings: [], blocked: [], pricing: [] }; }
      }
      return result;
    },
    enabled: properties.length > 0,
  });

  // Generate date columns
  const dates: string[] = [];
  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
    dates.push(fmtDate(d));
  }

  // Build booking/blocked maps per property
  const propertyMaps: Record<string, { bookings: Map<string, any>; blocked: Set<string>; pricing: Map<string, any>; defaults: any }> = {};
  for (const p of properties) {
    const cd = calendarData[p.id] || { bookings: [], blocked: [], pricing: [], defaults: {} };
    const bMap = new Map<string, any>();
    (cd.bookings || []).forEach((b: any) => {
      const s = new Date(b.checkIn.slice(0, 10) + "T12:00:00");
      const e = new Date(b.checkOut.slice(0, 10) + "T12:00:00");
      for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) bMap.set(fmtDate(d), b);
    });
    const blSet = new Set<string>();
    (cd.blocked || []).forEach((bl: any) => {
      const s = new Date((bl.startDate || "").slice(0, 10) + "T12:00:00");
      const e = new Date((bl.endDate || "").slice(0, 10) + "T12:00:00");
      for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) blSet.add(fmtDate(d));
    });
    const prMap = new Map<string, any>();
    (cd.pricing || []).forEach((pr: any) => {
      const d = typeof pr.date === "string" ? pr.date.slice(0, 10) : fmtDate(new Date(pr.date));
      prMap.set(d, pr);
    });
    propertyMaps[p.id] = { bookings: bMap, blocked: blSet, pricing: prMap, defaults: cd.defaults || {} };
  }

  if (propsLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarDays className="h-6 w-6" /> Calendar Overview</h1>
          <p className="text-muted-foreground mt-1">All properties at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewDays(14)}>14 days</Button>
          <Button variant="outline" size="sm" onClick={() => setViewDays(30)}>30 days</Button>
          <Button variant="outline" size="sm" onClick={() => setViewDays(60)}>60 days</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400" /> Requested</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Confirmed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Checked In</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400" /> Past Booking</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Blocked</span>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setStartOffset(o => o - viewDays)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setStartOffset(0)}>Today</Button>
        <Button variant="outline" size="sm" onClick={() => setStartOffset(o => o + viewDays)}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 z-10 min-w-[180px]">Property</th>
              {dates.map(d => {
                const dt = new Date(d + "T12:00:00");
                const isToday = d === today;
                const isWeekend = dt.getDay() === 5 || dt.getDay() === 6;
                return (
                  <th key={d} className={`px-0.5 py-2 text-center font-normal min-w-[36px] ${isToday ? "bg-primary/10" : isWeekend ? "bg-gray-100" : ""}`}>
                    <div className="text-[10px] text-muted-foreground">{dt.toLocaleDateString("en-US", { weekday: "narrow" })}</div>
                    <div className={`text-[11px] ${isToday ? "font-bold text-primary" : ""}`}>{dt.getDate()}</div>
                    {dt.getDate() === 1 && <div className="text-[9px] text-muted-foreground">{dt.toLocaleDateString("en-US", { month: "short" })}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {properties.map((p: any) => {
              const maps = propertyMaps[p.id];
              const defaultRate = parseFloat(maps?.defaults?.nightlyRate || "0");
              const weekendRate = parseFloat(maps?.defaults?.weekendRate || maps?.defaults?.nightlyRate || "0");

              return (
                <tr key={p.id} className="border-t hover:bg-accent/20">
                  <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r">
                    <button className="text-left hover:underline" onClick={() => navigate(`/portal/st-properties/${p.id}`)}>
                      <p className="font-medium truncate max-w-[160px]">{p.publicName || "Untitled"}</p>
                      <p className="text-[10px] text-muted-foreground">{p.area}</p>
                    </button>
                  </td>
                  {dates.map(d => {
                    const booking = maps?.bookings.get(d);
                    const isBlocked = maps?.blocked.has(d);
                    const customPrice = maps?.pricing.get(d);
                    const dt = new Date(d + "T12:00:00");
                    const isWeekend = dt.getDay() === 5 || dt.getDay() === 6;
                    const price = customPrice ? parseFloat(customPrice.price) : (isWeekend ? weekendRate : defaultRate);
                    const isToday = d === today;

                    let bg = "bg-green-50";
                    let content = null;
                    let title = `${d}\nAED ${price}`;

                    if (booking) {
                      bg = STATUS_COLORS[booking.status] || "bg-blue-400";
                      content = <div className="w-full h-full rounded-sm opacity-90" />;
                      title = `${d}\n${booking.guestName}\n${booking.status}\nAED ${price}`;
                    } else if (isBlocked) {
                      bg = "bg-red-100";
                      title = `${d}\nBlocked`;
                    } else if (customPrice) {
                      bg = "bg-amber-50";
                    }

                    return (
                      <td key={d} className={`px-0 py-0 ${isToday ? "ring-1 ring-primary ring-inset" : ""}`} title={title}>
                        <div className={`h-8 ${bg} ${booking ? "text-white" : ""} flex items-center justify-center`}>
                          {booking ? (
                            <span className="text-[9px] font-medium truncate px-0.5">{booking.guestName?.split(" ")[0]}</span>
                          ) : !isBlocked ? (
                            <span className="text-[9px] text-muted-foreground">{price > 0 ? price : ""}</span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {properties.length === 0 && (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          <Building className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No properties yet.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
