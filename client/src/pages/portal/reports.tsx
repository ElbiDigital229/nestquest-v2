import { useMemo } from "react";
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
  Loader2,
} from "lucide-react";

interface EarningsData {
  totalCommission: string;
  totalBookings: number;
  totalBookingIncome: string;
  totalOwnerPayouts: string;
  properties: {
    id: string;
    publicName: string;
    buildingName: string | null;
    unitNumber: string | null;
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

export default function ReportsPage() {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          My Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Your earnings and commission overview across all managed properties
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-emerald-50">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">My Commission</p>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(data?.totalCommission)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-blue-50">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Booking Revenue</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(data?.totalBookingIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-cyan-50">
              <Building className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Owner Payouts</p>
              <p className="text-2xl font-bold text-cyan-700">{formatCurrency(data?.totalOwnerPayouts)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-purple-50">
              <CalendarDays className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Bookings</p>
              <p className="text-2xl font-bold text-purple-700">{data?.totalBookings || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Property Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Earnings by Property</CardTitle>
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
                    <th className="px-4 py-2.5 font-medium text-center">Bookings</th>
                    <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                    <th className="px-4 py-2.5 font-medium text-right">My Commission</th>
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
                      <td className="px-4 py-2.5 text-center">{p.bookingCount}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(p.totalIncome)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatCurrency(p.commission)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(p.ownerPayout)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-center">{data.totalBookings}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(data.totalBookingIncome)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">{formatCurrency(data.totalCommission)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(data.totalOwnerPayouts)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Booking Commissions</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.recentBookings || data.recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No bookings yet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-2.5 font-medium">Property</th>
                    <th className="px-4 py-2.5 font-medium">Guest</th>
                    <th className="px-4 py-2.5 font-medium">Dates</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Total</th>
                    <th className="px-4 py-2.5 font-medium text-right">My Cut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentBookings.map((b) => (
                    <tr key={b.id} className="border-t hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5 truncate max-w-[180px]">{b.propertyName}</td>
                      <td className="px-4 py-2.5">{b.guestName || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {formatDate(b.checkIn)} – {formatDate(b.checkOut)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-[10px] border-0 ${STATUS_STYLES[b.status] || "bg-gray-100 text-gray-700"}`}>
                          {b.status?.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(b.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatCurrency(b.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
