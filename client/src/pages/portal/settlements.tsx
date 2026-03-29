import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  Clock,
  Loader2,
  Handshake,
  DollarSign,
  Building,
} from "lucide-react";

interface Settlement {
  id: string;
  bookingId: string;
  propertyId: string;
  fromUserId: string;
  toUserId: string;
  amount: string;
  reason: string;
  paymentMethodUsed: string;
  collectedBy: string;
  status: string;
  notes: string | null;
  proofUrl: string | null;
  paidAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  propertyName: string;
  buildingName: string | null;
  unitNumber: string | null;
  fromName: string;
  toName: string;
  checkIn: string;
  checkOut: string;
  bookingTotal: string;
  guestName: string;
}

interface SettlementsData {
  settlements: Settlement[];
  summary: {
    pendingOwed: string;
    pendingReceivable: string;
    totalPaid: string;
    totalReceived: string;
  };
}

function formatCurrency(v: string | number | null) {
  if (v == null) return "AED 0";
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(num)) return "AED 0";
  return `AED ${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  pending: { badge: "bg-yellow-100 text-yellow-800", label: "Pending" },
  paid: { badge: "bg-blue-100 text-blue-800", label: "Paid" },
  confirmed: { badge: "bg-green-100 text-green-800", label: "Confirmed" },
};

const REASON_LABELS: Record<string, string> = {
  owner_payout: "Owner Payout",
  pm_commission: "PM Commission",
};

export default function SettlementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payDialog, setPayDialog] = useState<Settlement | null>(null);
  const [payNotes, setPayNotes] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"all" | "owed" | "receivable" | "completed">("all");

  const { data, isLoading } = useQuery<SettlementsData>({
    queryKey: ["/st-properties/settlements"],
    queryFn: () => api.get("/st-properties/settlements"),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/st-properties/settlements/${id}/pay`, { notes: payNotes, proofUrl: proofUrl || null }),
    onSuccess: () => {
      toast({ title: "Settlement marked as paid" });
      queryClient.invalidateQueries({ queryKey: ["/st-properties/settlements"] });
      setPayDialog(null);
      setPayNotes("");
      setProofUrl("");
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/st-properties/settlements/${id}/confirm`),
    onSuccess: () => {
      toast({ title: "Receipt confirmed" });
      queryClient.invalidateQueries({ queryKey: ["/st-properties/settlements"] });
    },
    onError: (err: any) => toast({ title: err.message, variant: "destructive" }),
  });

  const settlements = data?.settlements || [];
  const summary = data?.summary;

  const filtered = settlements.filter((s) => {
    if (tab === "owed") return s.fromUserId === user?.id && s.status === "pending";
    if (tab === "receivable") return s.toUserId === user?.id && s.status === "pending";
    if (tab === "completed") return s.status === "paid" || s.status === "confirmed";
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Handshake className="h-6 w-6" />
          Settlements
        </h1>
        <p className="text-muted-foreground mt-1">
          Track payments between Property Manager and Property Owner
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-red-50">
              <ArrowUpRight className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">I Owe</p>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(summary?.pendingOwed)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-amber-50">
              <ArrowDownLeft className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Owed to Me</p>
              <p className="text-2xl font-bold text-amber-700">{formatCurrency(summary?.pendingReceivable)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-blue-50">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Paid Out</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(summary?.totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Received</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(summary?.totalReceived)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          ["all", "All"],
          ["owed", "I Owe"],
          ["receivable", "Owed to Me"],
          ["completed", "Completed"],
        ] as [string, string][]).map(([key, label]) => (
          <Button
            key={key}
            variant={tab === key ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(key as any)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Handshake className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No settlements found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left border-b">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Property</th>
                    <th className="px-4 py-2.5 font-medium">Booking</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">From → To</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const isOwe = s.fromUserId === user?.id;
                    const isReceive = s.toUserId === user?.id;
                    const style = STATUS_STYLES[s.status] || STATUS_STYLES.pending;

                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(s.createdAt)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium truncate max-w-[160px]">{s.propertyName || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {[s.buildingName, s.unitNumber ? `Unit ${s.unitNumber}` : null].filter(Boolean).join(", ")}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm">{s.guestName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(s.checkIn)} – {formatDate(s.checkOut)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">
                            {REASON_LABELS[s.reason] || s.reason}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={isOwe ? "text-red-700 font-medium" : ""}>{s.fromName}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className={isReceive ? "text-green-700 font-medium" : ""}>{s.toName}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-[10px] border-0 ${style.badge}`}>{style.label}</Badge>
                          {s.paidAt && <p className="text-xs text-muted-foreground mt-0.5">{formatDate(s.paidAt)}</p>}
                          {s.proofUrl && (
                            <a href={s.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-0.5 block">
                              View proof
                            </a>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${isOwe ? "text-red-700" : "text-green-700"}`}>
                          {isOwe ? "-" : "+"}{formatCurrency(s.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {s.status === "pending" && isOwe && (
                            <Button size="sm" variant="default" onClick={() => { setPayDialog(s); setPayNotes(""); }}>
                              Mark Paid
                            </Button>
                          )}
                          {s.status === "paid" && isReceive && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => confirmMutation.mutate(s.id)}
                              disabled={confirmMutation.isPending}
                            >
                              {confirmMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Receipt"}
                            </Button>
                          )}
                          {s.status === "confirmed" && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Settled
                            </span>
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

      {/* Pay Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(open) => !open && setPayDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Settlement as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold">{formatCurrency(payDialog?.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-medium">{payDialog?.toName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Property</span>
                <span>{payDialog?.propertyName}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes / Reference (optional)</label>
              <Input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="e.g. Bank transfer ref #12345"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Payment Proof (optional)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const formData = new FormData();
                      formData.append("file", file);
                      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
                      const data = await res.json();
                      if (data.url) setProofUrl(data.url);
                      else toast({ title: "Upload failed", variant: "destructive" });
                    } catch {
                      toast({ title: "Upload failed", variant: "destructive" });
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {proofUrl && (
                <div className="mt-2">
                  <img src={proofUrl} alt="Payment proof" className="max-h-32 rounded-md border" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button
              disabled={payMutation.isPending}
              onClick={() => payDialog && payMutation.mutate(payDialog.id)}
            >
              {payMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
