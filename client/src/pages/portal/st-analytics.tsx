import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, TrendingUp, Home, CalendarDays, DollarSign,
  Users, Clock, XCircle, Loader2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  activeProperties: number;
  totalAvailableNights: number;
  bookedNights: number;
  occupancyRate: number;
  revenue: number;
  adr: number;
  revpar: number;
  totalBookings: number;
  avgStay: number;
  avgLeadDays: number;
  cancellations: number;
  declines: number;
  totalRequests: number;
}

interface MonthlyRow {
  month: string;
  bookings: number;
  nights: number;
  revenue: string;
}

interface SourceRow {
  source: string;
  bookings: number;
  revenue: string;
}

interface PropertyRow {
  id: string;
  name: string;
  unitNumber: string | null;
  city: string | null;
  status: string;
  bookings: number;
  nights: number;
  revenue: string;
  adr: string;
  occupancy: string;
}

interface AnalyticsData {
  range: { from: string; to: string; days: number };
  summary: AnalyticsSummary;
  monthly: MonthlyRow[];
  sources: SourceRow[];
  properties: PropertyRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtAED(n: number) {
  return `AED ${fmt(n, 0)}`;
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

const PRESET_RANGES: { label: string; from: number; to: number }[] = [
  { label: "Last 30d", from: -30, to: 0 },
  { label: "Next 30d", from: 0, to: 30 },
  { label: "Last 90d", from: -90, to: 0 },
  { label: "Next 90d", from: 0, to: 90 },
  { label: "Last 12mo", from: -365, to: 0 },
];

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  airbnb: "Airbnb",
  booking_com: "Booking.com",
  vrbo: "VRBO",
  direct: "Direct",
  walk_in: "Walk-in",
  other: "Other",
};

const SOURCE_COLORS: Record<string, string> = {
  website: "bg-blue-500",
  airbnb: "bg-rose-500",
  booking_com: "bg-sky-500",
  vrbo: "bg-violet-500",
  direct: "bg-emerald-500",
  walk_in: "bg-amber-500",
  other: "bg-slate-400",
};

// ── Sub-components ────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, color = "text-primary", trend,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: any;
  color?: string;
  trend?: { value: string; up: boolean };
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted/60`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.up ? "text-emerald-600" : "text-red-500"}`}>
            {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend.value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Simple SVG bar chart
function BarChart({ data, valueKey }: { data: MonthlyRow[]; valueKey: "revenue" | "bookings" | "nights" }) {
  const values = data.map((d) => parseFloat(d[valueKey] as string) || 0);
  const max = Math.max(...values, 1);
  const chartHeight = 160;

  return (
    <div className="flex items-end gap-1 h-44 pt-2">
      {data.map((row, i) => {
        const val = values[i];
        const barH = Math.round((val / max) * chartHeight);
        const monthLabel = row.month.slice(5); // "MM"
        return (
          <div key={row.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover border rounded-lg px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-sm">
              <p className="font-medium">{row.month}</p>
              {valueKey === "revenue" && <p>AED {fmt(val, 0)}</p>}
              {valueKey === "bookings" && <p>{val} bookings</p>}
              {valueKey === "nights" && <p>{val} nights</p>}
            </div>
            <div className="w-full rounded-t-sm bg-primary/80 hover:bg-primary transition-colors" style={{ height: `${barH}px`, minHeight: val > 0 ? "3px" : "0" }} />
            <span className="text-[10px] text-muted-foreground">{monthLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function StAnalytics() {
  const today = new Date();
  // Default: last 30 days → next 30 days (covers both historical and upcoming bookings)
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 30 * 86400000)));
  const [toDate, setToDate] = useState(isoDate(new Date(Date.now() + 30 * 86400000)));
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [chartMetric, setChartMetric] = useState<"revenue" | "bookings" | "nights">("revenue");

  const queryParams = new URLSearchParams({
    from: fromDate,
    to: toDate,
    ...(propertyFilter !== "all" && { propertyId: propertyFilter }),
  }).toString();

  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/st-properties/analytics", fromDate, toDate, propertyFilter],
    queryFn: () => api.get(`/st-properties/analytics?${queryParams}`),
  });

  // Also fetch property list for filter dropdown
  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ["/st-properties"],
    queryFn: () => api.get("/st-properties"),
  });

  function applyPreset(from: number, to: number) {
    setFromDate(isoDate(new Date(Date.now() + from * 86400000)));
    setToDate(isoDate(new Date(Date.now() + to * 86400000)));
  }

  const s = data?.summary;
  const cancellationRate = s && s.totalRequests > 0
    ? ((s.cancellations + s.declines) / s.totalRequests * 100).toFixed(1)
    : "0";

  // Fill in missing months for the chart (ensure 13 contiguous months)
  const filledMonthly = useMemo(() => {
    if (!data?.monthly) return [];
    const byMonth: Record<string, MonthlyRow> = {};
    for (const r of data.monthly) byMonth[r.month] = r;
    return data.monthly;
  }, [data?.monthly]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground flex-col gap-2">
        <p className="font-medium text-destructive">Failed to load analytics</p>
        <p className="text-xs text-muted-foreground">{(error as any)?.message || "Unknown error"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> ST Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Occupancy, revenue, ADR, and RevPAR across your short-term portfolio
          </p>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_RANGES.map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => applyPreset(p.from, p.to)}
            >
              {p.label}
            </Button>
          ))}
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36 text-xs" />
          <span className="text-muted-foreground text-xs">to</span>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36 text-xs" />
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.publicName || p.buildingName || "Property"} {p.unitNumber ? `#${p.unitNumber}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : s ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard title="Total Revenue" value={fmtAED(s.revenue)} sub={`${data?.range.days} day period`} icon={DollarSign} color="text-emerald-600" />
          <KpiCard title="Occupancy Rate" value={`${fmt(s.occupancyRate, 1)}%`} sub={`${fmt(s.bookedNights, 0)} / ${fmt(s.totalAvailableNights, 0)} nights`} icon={Home} color="text-blue-600" />
          <KpiCard title="ADR" value={fmtAED(s.adr)} sub="Avg. daily rate (booked nights)" icon={TrendingUp} color="text-violet-600" />
          <KpiCard title="RevPAR" value={fmtAED(s.revpar)} sub="Revenue per available room night" icon={BarChart3} color="text-amber-600" />
          <KpiCard title="Total Bookings" value={fmt(s.totalBookings)} sub={`${s.activeProperties} active properties`} icon={CalendarDays} />
          <KpiCard title="Avg. Stay Length" value={`${fmt(s.avgStay, 1)} nights`} sub="Per completed booking" icon={Clock} />
          <KpiCard title="Booking Lead Time" value={`${fmt(s.avgLeadDays, 0)} days`} sub="Avg. advance booking window" icon={Users} />
          <KpiCard title="Cancellation Rate" value={`${cancellationRate}%`} sub={`${s.cancellations} cancelled, ${s.declines} declined`} icon={XCircle} color={parseFloat(cancellationRate) > 15 ? "text-red-500" : "text-muted-foreground"} />
        </div>
      ) : null}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Monthly Trend (Last 13 Months)</CardTitle>
              <div className="flex gap-1">
                {(["revenue", "bookings", "nights"] as const).map((m) => (
                  <Button
                    key={m}
                    variant={chartMetric === m ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs capitalize"
                    onClick={() => setChartMetric(m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-44 w-full" /> : (
              filledMonthly.length > 0
                ? <BarChart data={filledMonthly} valueKey={chartMetric} />
                : <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">No booking data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Booking Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-44 w-full" /> : (
              data?.sources && data.sources.length > 0 ? (
                <div className="space-y-3 mt-1">
                  {(() => {
                    const totalBookings = data.sources.reduce((s, r) => s + r.bookings, 0);
                    return data.sources.map((row) => {
                      const pct = totalBookings > 0 ? (row.bookings / totalBookings * 100) : 0;
                      const colorClass = SOURCE_COLORS[row.source] || "bg-slate-400";
                      return (
                        <div key={row.source}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium">{SOURCE_LABELS[row.source] || row.source}</span>
                            <span className="text-muted-foreground text-xs">{row.bookings} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">No data for this period</div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Property Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Property Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><Skeleton className="h-32 w-full" /></div>
          ) : data?.properties && data.properties.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left border-b">
                    <th className="px-4 py-3 font-medium">Property</th>
                    <th className="px-4 py-3 font-medium text-right">Bookings</th>
                    <th className="px-4 py-3 font-medium text-right">Nights</th>
                    <th className="px-4 py-3 font-medium text-right">Revenue</th>
                    <th className="px-4 py-3 font-medium text-right">ADR</th>
                    <th className="px-4 py-3 font-medium text-right">Occupancy</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.properties.map((p) => {
                    const occ = parseFloat(p.occupancy);
                    const occColor = occ >= 70 ? "text-emerald-600" : occ >= 40 ? "text-amber-600" : "text-muted-foreground";
                    return (
                      <tr key={p.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.name}</p>
                          {(p.unitNumber || p.city) && (
                            <p className="text-xs text-muted-foreground">
                              {[p.unitNumber && `Unit ${p.unitNumber}`, p.city].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{p.bookings}</td>
                        <td className="px-4 py-3 text-right">{p.nights}</td>
                        <td className="px-4 py-3 text-right font-medium">AED {fmt(parseFloat(p.revenue), 0)}</td>
                        <td className="px-4 py-3 text-right">AED {fmt(parseFloat(p.adr), 0)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${occColor}`}>{occ.toFixed(1)}%</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={
                            p.status === "active" ? "bg-green-100 text-green-700" :
                            p.status === "inactive" ? "bg-slate-100 text-slate-600" :
                            "bg-amber-100 text-amber-700"
                          }>
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              No properties found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancellation Breakdown */}
      {s && (s.cancellations > 0 || s.declines > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cancellation Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{s.totalRequests}</p>
                <p className="text-xs text-muted-foreground">Total Requests</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{s.cancellations}</p>
                <p className="text-xs text-muted-foreground">Cancelled by Guest</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{s.declines}</p>
                <p className="text-xs text-muted-foreground">Declined by PM</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
