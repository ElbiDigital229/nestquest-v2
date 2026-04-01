import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, DollarSign, TrendingUp, Building, Star, Loader2,
} from "lucide-react";

function formatCurrency(v: string | number | null | undefined) {
  if (v == null) return "AED 0";
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(num)) return "AED 0";
  return `AED ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function PoReports() {
  // Get PO's properties
  const { data: properties = [], isLoading: propsLoading } = useQuery<any[]>({
    queryKey: ["/st-properties/po/my-properties"],
    queryFn: () => api.get("/st-properties/po/my-properties"),
  });

  // Get investment summary for each property
  const { data: summaries = {}, isLoading: summLoading } = useQuery<Record<string, any>>({
    queryKey: ["/po-reports", properties.map(p => p.id).join(",")],
    queryFn: async () => {
      const result: Record<string, any> = {};
      for (const p of properties) {
        try {
          result[p.id] = await api.get(`/st-properties/${p.id}/investment-summary`);
        } catch { result[p.id] = null; }
      }
      return result;
    },
    enabled: properties.length > 0,
  });

  // Get reviews for each property
  const { data: reviewData = {} } = useQuery<Record<string, any>>({
    queryKey: ["/po-reviews-summary", properties.map(p => p.id).join(",")],
    queryFn: async () => {
      const result: Record<string, any> = {};
      for (const p of properties) {
        try {
          result[p.id] = await api.get(`/public/properties/${p.id}/reviews?limit=1`);
        } catch { result[p.id] = { total: 0, avgRating: 0 }; }
      }
      return result;
    },
    enabled: properties.length > 0,
  });

  if (propsLoading || summLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  // Aggregate across all properties
  let totalInvestment = 0, totalRevenue = 0, totalCommission = 0, totalOwnerPayout = 0;
  let totalExpenses = 0, totalInventory = 0, totalNetProfit = 0;
  let totalBookings = 0, totalReviews = 0, totalDepositsHeld = 0;

  for (const p of properties) {
    const s = summaries[p.id];
    if (!s) continue;
    totalInvestment += parseFloat(s.totalInvestment || "0");
    totalRevenue += parseFloat(s.totalIncome || "0");
    totalCommission += parseFloat(s.totalCommission || "0");
    totalOwnerPayout += parseFloat(s.totalOwnerPayout || "0");
    totalExpenses += parseFloat(s.totalExpenses || "0");
    totalInventory += parseFloat(s.inventoryValue || "0");
    totalNetProfit += parseFloat(s.netProfit || "0");
    totalBookings += s.bookingCount || 0;
    totalDepositsHeld += parseFloat(s.depositsHeld || "0");
    const rv = reviewData[p.id];
    if (rv) totalReviews += rv.total || 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> My Reports</h1>
        <p className="text-muted-foreground mt-1">Portfolio overview across all your properties</p>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg p-2.5 bg-blue-50"><Building className="h-5 w-5 text-blue-600" /></div>
          <div><p className="text-xs text-muted-foreground font-medium">Total Investment</p><p className="text-2xl font-bold text-blue-700">{formatCurrency(totalInvestment)}</p><p className="text-xs text-muted-foreground">{properties.length} properties</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg p-2.5 bg-emerald-50"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
          <div><p className="text-xs text-muted-foreground font-medium">Rental Revenue</p><p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalRevenue)}</p><p className="text-xs text-muted-foreground">{totalBookings} bookings (excl. deposits)</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg p-2.5 bg-cyan-50"><DollarSign className="h-5 w-5 text-cyan-600" /></div>
          <div><p className="text-xs text-muted-foreground font-medium">Owner Payout</p><p className="text-2xl font-bold text-cyan-700">{formatCurrency(totalOwnerPayout)}</p><p className="text-xs text-muted-foreground">After commission</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className={`rounded-lg p-2.5 ${totalNetProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}><BarChart3 className={`h-5 w-5 ${totalNetProfit >= 0 ? "text-green-600" : "text-red-600"}`} /></div>
          <div><p className="text-xs text-muted-foreground font-medium">Net Profit</p><p className={`text-2xl font-bold ${totalNetProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(totalNetProfit)}</p><p className="text-xs text-muted-foreground">Revenue - all costs</p></div>
        </CardContent></Card>
      </div>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-base">Cost Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-xs text-muted-foreground">PM Commission</p><p className="text-lg font-bold text-purple-700">{formatCurrency(totalCommission)}</p></div>
            <div><p className="text-xs text-muted-foreground">Inventory</p><p className="text-lg font-bold text-indigo-700">{formatCurrency(totalInventory)}</p></div>
            <div><p className="text-xs text-muted-foreground">Expenses</p><p className="text-lg font-bold text-orange-700">{formatCurrency(totalExpenses)}</p></div>
            <div><p className="text-xs text-muted-foreground">Deposits Held</p><p className="text-lg font-bold text-amber-700">{formatCurrency(totalDepositsHeld)}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Property Breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-base">Property Breakdown</CardTitle></CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No properties yet.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-2.5 font-medium">Property</th>
                    <th className="px-4 py-2.5 font-medium text-center">Bookings</th>
                    <th className="px-4 py-2.5 font-medium text-center">Reviews</th>
                    <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                    <th className="px-4 py-2.5 font-medium text-right">Commission</th>
                    <th className="px-4 py-2.5 font-medium text-right">Your Payout</th>
                    <th className="px-4 py-2.5 font-medium text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p: any) => {
                    const s = summaries[p.id] || {};
                    const rv = reviewData[p.id] || {};
                    const net = parseFloat(s.netProfit || "0");
                    return (
                      <tr key={p.id} className="border-t hover:bg-accent/30">
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{p.name || p.publicName || p.id}</p>
                          <p className="text-xs text-muted-foreground capitalize">{p.city}</p>
                        </td>
                        <td className="px-4 py-2.5 text-center">{s.bookingCount || 0}</td>
                        <td className="px-4 py-2.5 text-center">
                          {rv.total > 0 ? (
                            <span className="flex items-center justify-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              {Number(rv.avgRating).toFixed(1)} ({rv.total})
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(s.totalIncome)}</td>
                        <td className="px-4 py-2.5 text-right text-purple-700">{formatCurrency(s.totalCommission)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-cyan-700">{formatCurrency(s.totalOwnerPayout)}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${net >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(s.netProfit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-center">{totalBookings}</td>
                    <td className="px-4 py-2.5 text-center">{totalReviews}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(totalRevenue)}</td>
                    <td className="px-4 py-2.5 text-right text-purple-700">{formatCurrency(totalCommission)}</td>
                    <td className="px-4 py-2.5 text-right text-cyan-700">{formatCurrency(totalOwnerPayout)}</td>
                    <td className={`px-4 py-2.5 text-right ${totalNetProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(totalNetProfit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
