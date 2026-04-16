import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Building,
  CalendarDays,
  Percent,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EarningsData {
  totalCommission: string;
  totalBookings: number;
  activeBookings: number;
  totalBookingIncome: string;
  totalOwnerPayouts: string;
  percentageEarnings: string;
  percentageRevenue: string;
  percentageBookings: number;
  fixedRevenue: string;
  fixedBookings: number;
  monthlyFixedTotal: string;
  properties: {
    id: string;
    publicName: string;
    buildingName: string | null;
    unitNumber: string | null;
    commissionType: string | null;
    commissionValue: string | null;
    bookingCount: number;
    totalIncome: string;
    commission: string;
    ownerPayout: string;
  }[];
  recentBookings: {
    id: string;
    propertyName: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    totalAmount: string;
    commission: string;
    commissionType: string | null;
    commissionValue: string | null;
    source: string | null;
    paymentStatus: string | null;
    status: string;
    createdAt: string;
  }[];
}

function formatCurrency(v: string | number | null | undefined) {
  if (v == null) return "AED 0";
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(num)) return "AED 0";
  return `AED ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  checked_in: "bg-green-100 text-green-800",
  checked_out: "bg-orange-100 text-orange-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
  declined: "bg-gray-100 text-gray-800",
};

type BookingFilter = "all" | "percentage" | "fixed";

export default function ReportsPage() {
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");

  const { data, isLoading } = useQuery<EarningsData>({
    queryKey: ["/st-properties/reports/earnings"],
    queryFn: () => api.get("/st-properties/reports/earnings"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const percentageEarnings = parseFloat(data?.percentageEarnings || "0");
  const monthlyFixed = parseFloat(data?.monthlyFixedTotal || "0");
  const totalPmRevenue = percentageEarnings + monthlyFixed;

  const filteredBookings = (data?.recentBookings || []).filter((b) => {
    if (bookingFilter === "all") return true;
    if (bookingFilter === "percentage") return b.commissionType === "percentage_per_booking";
    return b.commissionType === "fixed_monthly";
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          My Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Revenue breakdown by fee type across all managed properties
        </p>
      </div>

      {/* ── Revenue Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-emerald-50">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total PM Revenue</p>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalPmRevenue)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Commission + Fixed Fees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-blue-50">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Booking Revenue</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(data?.totalBookingIncome)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{data?.totalBookings || 0} bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-cyan-50">
                <Building className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Owner Payouts</p>
                <p className="text-2xl font-bold text-cyan-700">{formatCurrency(data?.totalOwnerPayouts)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-purple-50">
                <CalendarDays className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Bookings</p>
                <p className="text-2xl font-bold text-purple-700">{data?.activeBookings || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue by Fee Type ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2.5 bg-amber-50 shrink-0">
                <Percent className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Percentage Commission</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(data?.percentageEarnings)}</p>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Bookings</p>
                    <p className="font-semibold">{data?.percentageBookings || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Revenue Generated</p>
                    <p className="font-semibold">{formatCurrency(data?.percentageRevenue)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2.5 bg-indigo-50 shrink-0">
                <Banknote className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Fixed Monthly Fees</p>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{formatCurrency(data?.monthlyFixedTotal)}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Bookings Managed</p>
                    <p className="font-semibold">{data?.fixedBookings || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Revenue Generated</p>
                    <p className="font-semibold">{formatCurrency(data?.fixedRevenue)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Earnings by Property ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="h-4 w-4" /> Earnings by Property
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.properties || data.properties.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No properties with bookings yet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-2.5 font-medium">Property</th>
                    <th className="px-4 py-2.5 font-medium">Fee Type</th>
                    <th className="px-4 py-2.5 font-medium text-center">Bookings</th>
                    <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                    <th className="px-4 py-2.5 font-medium text-right">My Earnings</th>
                    <th className="px-4 py-2.5 font-medium text-right">Owner Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {data.properties.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{p.publicName || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[p.buildingName, p.unitNumber ? `Unit ${p.unitNumber}` : null].filter(Boolean).join(", ")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5">
                        {p.commissionType === "percentage_per_booking" ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            <Percent className="h-2.5 w-2.5 mr-1" />
                            {p.commissionValue}%
                          </Badge>
                        ) : p.commissionType === "fixed_monthly" ? (
                          <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                            <Banknote className="h-2.5 w-2.5 mr-1" />
                            AED {p.commissionValue}/mo
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">{p.bookingCount}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(p.totalIncome)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">
                        {p.commissionType === "percentage_per_booking" ? (
                          formatCurrency(p.commission)
                        ) : p.commissionType === "fixed_monthly" ? (
                          <span className="text-indigo-700">{formatCurrency(p.commissionValue)}/mo</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(p.ownerPayout)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-4 py-2.5" colSpan={2}>Total</td>
                    <td className="px-4 py-2.5 text-center">{data.totalBookings}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(data.totalBookingIncome)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">{formatCurrency(totalPmRevenue)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(data.totalOwnerPayouts)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── All Bookings ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> All Bookings
            </CardTitle>
            <div className="flex gap-1.5">
              {([
                { key: "all" as BookingFilter, label: "All" },
                { key: "percentage" as BookingFilter, label: "% Cut" },
                { key: "fixed" as BookingFilter, label: "Fixed Fee" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setBookingFilter(tab.key)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    bookingFilter === tab.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No bookings found.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-2.5 font-medium">Property</th>
                    <th className="px-4 py-2.5 font-medium">Guest</th>
                    <th className="px-4 py-2.5 font-medium">Dates</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Fee Type</th>
                    <th className="px-4 py-2.5 font-medium text-right">Booking Total</th>
                    <th className="px-4 py-2.5 font-medium text-right">My Cut</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => {
                    const isPercentage = b.commissionType === "percentage_per_booking";
                    const commission = parseFloat(b.commission || "0");
                    return (
                      <tr key={b.id} className="border-t hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-2.5 truncate max-w-[160px]">{b.propertyName}</td>
                        <td className="px-4 py-2.5">
                          <p>{b.guestName || "—"}</p>
                          {b.source && b.source !== "website" && (
                            <p className="text-[10px] text-muted-foreground capitalize">{b.source.replace("_", ".")}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDate(b.checkIn)} – {formatDate(b.checkOut)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className={`text-[10px] border-0 ${STATUS_STYLES[b.status] || "bg-gray-100 text-gray-700"}`}>
                            {b.status?.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {isPercentage ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                              {b.commissionValue}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                              Fixed
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(b.totalAmount)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {isPercentage && commission > 0 ? (
                            <span className="text-emerald-700 flex items-center justify-end gap-0.5">
                              <ArrowUpRight className="h-3 w-3" />
                              {formatCurrency(commission)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
