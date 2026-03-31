import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowUpRight, ArrowDownLeft, CheckCircle, Loader2, Handshake, DollarSign,
} from "lucide-react";

interface Settlement {
  id: string;
  bookingId: string | null;
  expenseId: string | null;
  propertyId: string;
  fromUserId: string;
  toUserId: string;
  amount: string;
  reason: string;
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
  checkIn: string | null;
  checkOut: string | null;
  bookingTotal: string | null;
  guestName: string | null;
  expenseCategory: string | null;
  expenseDescription: string | null;
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
  owner_payout: "Booking — Owner Payout",
  pm_commission: "Booking — PM Commission",
  expense_reimbursement: "Expense — Reimbursement",
  deposit_forfeiture: "Deposit — Damage Deduction",
};

const REASON_COLORS: Record<string, string> = {
  owner_payout: "bg-blue-50 border-blue-200",
  pm_commission: "bg-purple-50 border-purple-200",
  expense_reimbursement: "bg-orange-50 border-orange-200",
  deposit_forfeiture: "bg-red-50 border-red-200",
};

export default function SettlementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [payDialog, setPayDialog] = useState<Settlement | null>(null);
  const [detailDialog, setDetailDialog] = useState<Settlement | null>(null);
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
      setPayDialog(null); setPayNotes(""); setProofUrl("");
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
  const isPmOrTeam = user?.role === "PROPERTY_MANAGER" || user?.role === "PM_TEAM_MEMBER";

  const filtered = settlements.filter((s) => {
    if (tab === "owed") return s.fromUserId === user?.id && s.status === "pending";
    if (tab === "receivable") return s.toUserId === user?.id && s.status === "pending";
    if (tab === "completed") return s.status === "paid" || s.status === "confirmed";
    return true;
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Handshake className="h-6 w-6" /> Settlements</h1>
        <p className="text-muted-foreground mt-1">Track all payments between Property Manager and Property Owner</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg p-2.5 bg-red-50"><ArrowUpRight className="h-5 w-5 text-red-600" /></div>
          <div><p className="text-xs text-muted-foreground font-medium">I Owe</p><p className="text-2xl font-bold text-red-700">{formatCurrency(summary?.pendingOwed)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg p-2.5 bg-amber-50"><ArrowDownLeft className="h-5 w-5 text-amber-600" /></div>
          <div><p className="text-xs text-muted-foreground font-medium">Owed to Me</p><p className="text-2xl font-bold text-amber-700">{formatCurrency(summary?.pendingReceivable)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg p-2.5 bg-blue-50"><DollarSign className="h-5 w-5 text-blue-600" /></div>
          <div><p className="text-xs text-muted-foreground font-medium">Total Paid Out</p><p className="text-2xl font-bold text-blue-700">{formatCurrency(summary?.totalPaid)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg p-2.5 bg-green-50"><CheckCircle className="h-5 w-5 text-green-600" /></div>
          <div><p className="text-xs text-muted-foreground font-medium">Total Received</p><p className="text-2xl font-bold text-green-700">{formatCurrency(summary?.totalReceived)}</p></div>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([["all", "All"], ["owed", "I Owe"], ["receivable", "Owed to Me"], ["completed", "Completed"]] as [string, string][]).map(([key, label]) => (
          <Button key={key} variant={tab === key ? "default" : "outline"} size="sm" onClick={() => setTab(key as any)}>
            {label}
            {key !== "all" && <Badge variant="secondary" className="ml-1 text-[10px]">{
              settlements.filter(s => {
                if (key === "owed") return s.fromUserId === user?.id && s.status === "pending";
                if (key === "receivable") return s.toUserId === user?.id && s.status === "pending";
                if (key === "completed") return s.status === "paid" || s.status === "confirmed";
                return false;
              }).length
            }</Badge>}
          </Button>
        ))}
      </div>

      {/* Settlement Cards */}
      {filtered.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          <Handshake className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No settlements found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const isOwe = s.fromUserId === user?.id;
            const isReceive = s.toUserId === user?.id;
            const style = STATUS_STYLES[s.status] || STATUS_STYLES.pending;
            const isBooking = !!s.bookingId;
            const isExpense = !!s.expenseId;

            return (
              <Card key={s.id} className={`border ${REASON_COLORS[s.reason] || ""} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => setDetailDialog(s)}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Left: Context */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {REASON_LABELS[s.reason] || s.reason}
                        </Badge>
                        <Badge className={`text-[10px] border-0 ${style.badge}`}>{style.label}</Badge>
                      </div>

                      {/* Property */}
                      <p className="font-medium">{s.propertyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[s.buildingName, s.unitNumber ? `Unit ${s.unitNumber}` : null].filter(Boolean).join(", ")}
                      </p>

                      {/* Context: Booking or Expense */}
                      {isBooking && (
                        <div className="mt-2 text-sm bg-muted/50 rounded px-3 py-2">
                          <p><span className="text-muted-foreground">Guest:</span> <span className="font-medium">{s.guestName}</span></p>
                          <p><span className="text-muted-foreground">Dates:</span> {formatDate(s.checkIn)} – {formatDate(s.checkOut)}</p>
                          {s.bookingTotal && <p><span className="text-muted-foreground">Booking Total:</span> {formatCurrency(s.bookingTotal)}</p>}
                        </div>
                      )}
                      {isExpense && (
                        <div className="mt-2 text-sm bg-muted/50 rounded px-3 py-2">
                          <p><span className="text-muted-foreground">Expense:</span> <span className="font-medium">{s.expenseDescription || s.expenseCategory || "—"}</span></p>
                          {s.expenseCategory && <p><span className="text-muted-foreground">Category:</span> {s.expenseCategory.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p>}
                        </div>
                      )}

                      {/* From → To */}
                      <p className="text-sm mt-2">
                        <span className={isOwe ? "text-red-700 font-semibold" : ""}>{s.fromName}</span>
                        <span className="text-muted-foreground mx-2">owes</span>
                        <span className={isReceive ? "text-green-700 font-semibold" : ""}>{s.toName}</span>
                      </p>

                      {/* Proof / Notes */}
                      {s.notes && <p className="text-xs text-muted-foreground mt-1">Note: {s.notes}</p>}
                      {s.proofUrl && <a href={s.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View payment proof</a>}
                      {s.paidAt && <p className="text-xs text-muted-foreground">Paid: {formatDate(s.paidAt)}</p>}
                      {s.confirmedAt && <p className="text-xs text-muted-foreground">Confirmed: {formatDate(s.confirmedAt)}</p>}
                    </div>

                    {/* Right: Amount + Action */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className={`text-2xl font-bold ${isOwe ? "text-red-700" : "text-green-700"}`}>
                        {isOwe ? "-" : "+"}{formatCurrency(s.amount)}
                      </p>

                      {s.status === "pending" && isPmOrTeam && (
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); setPayDialog(s); setPayNotes(""); setProofUrl(""); }}>
                          Mark as Paid
                        </Button>
                      )}
                      {s.status === "pending" && !isPmOrTeam && (
                        <p className="text-xs text-amber-600 font-medium">Pending</p>
                      )}
                      {(s.status === "paid" || s.status === "confirmed") && (
                        <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Settled</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detailDialog && (() => {
            const s = detailDialog;
            const isBooking = !!s.bookingId;
            const isExpense = !!s.expenseId;
            const style = STATUS_STYLES[s.status] || STATUS_STYLES.pending;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>Settlement Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Status + Type */}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{REASON_LABELS[s.reason] || s.reason}</Badge>
                    <Badge className={`text-[10px] border-0 ${style.badge}`}>{style.label}</Badge>
                  </div>

                  {/* Amount */}
                  <div className="text-center py-3 bg-muted/50 rounded-lg">
                    <p className="text-3xl font-bold">{formatCurrency(s.amount)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {s.fromName} <span className="mx-1">→</span> {s.toName}
                    </p>
                  </div>

                  {/* Property */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Property</p>
                    <p className="font-medium">{s.propertyName}</p>
                    <p className="text-sm text-muted-foreground">{[s.buildingName, s.unitNumber ? `Unit ${s.unitNumber}` : null].filter(Boolean).join(", ")}</p>
                  </div>

                  {/* Booking Context */}
                  {isBooking && (
                    <div className="space-y-1 bg-blue-50/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Booking</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-muted-foreground">Guest</p><p className="font-medium">{s.guestName}</p></div>
                        <div><p className="text-muted-foreground">Booking Total</p><p className="font-medium">{formatCurrency(s.bookingTotal)}</p></div>
                        <div><p className="text-muted-foreground">Check-in</p><p>{formatDate(s.checkIn)}</p></div>
                        <div><p className="text-muted-foreground">Check-out</p><p>{formatDate(s.checkOut)}</p></div>
                      </div>
                    </div>
                  )}

                  {/* Expense Context */}
                  {isExpense && (
                    <div className="space-y-1 bg-orange-50/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Expense</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-muted-foreground">Description</p><p className="font-medium">{s.expenseDescription || "—"}</p></div>
                        <div><p className="text-muted-foreground">Category</p><p>{s.expenseCategory?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "—"}</p></div>
                      </div>
                    </div>
                  )}

                  {/* Payment Details */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Payment</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><p className="text-muted-foreground">Status</p><Badge className={`text-[10px] border-0 ${style.badge}`}>{style.label}</Badge></div>
                      <div><p className="text-muted-foreground">Created</p><p>{formatDate(s.createdAt)}</p></div>
                      {s.paidAt && <div><p className="text-muted-foreground">Paid</p><p>{formatDate(s.paidAt)}</p></div>}
                      {s.confirmedAt && <div><p className="text-muted-foreground">Confirmed</p><p>{formatDate(s.confirmedAt)}</p></div>}
                      {s.collectedBy && <div><p className="text-muted-foreground">Collected By</p><p>{s.collectedBy.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</p></div>}
                    </div>
                  </div>

                  {/* Notes */}
                  {s.notes && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Notes</p>
                      <p className="text-sm bg-muted/50 rounded p-2">{s.notes}</p>
                    </div>
                  )}

                  {/* Proof */}
                  {s.proofUrl && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Payment Proof</p>
                      <a href={s.proofUrl} target="_blank" rel="noopener noreferrer">
                        <img src={s.proofUrl} alt="Payment proof" className="max-h-48 rounded border hover:opacity-80 transition" />
                      </a>
                    </div>
                  )}

                  {/* Action */}
                  {s.status === "pending" && isPmOrTeam && (
                    <Button className="w-full" onClick={() => { setDetailDialog(null); setPayDialog(s); setPayNotes(""); setProofUrl(""); }}>
                      Mark as Paid
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={!!payDialog} onOpenChange={(open) => !open && setPayDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Mark Settlement as Paid</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">{formatCurrency(payDialog?.amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">To</span><span className="font-medium">{payDialog?.toName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Property</span><span>{payDialog?.propertyName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{REASON_LABELS[payDialog?.reason || ""] || payDialog?.reason}</span></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes / Reference (optional)</label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="e.g. Bank transfer ref #12345" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Payment Proof (optional)</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*,.pdf" className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground file:cursor-pointer"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setUploading(true);
                    try { const fd = new FormData(); fd.append("file", file); const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" }); const data = await res.json(); if (data.url) setProofUrl(data.url); } catch {} finally { setUploading(false); }
                  }} />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {proofUrl && <img src={proofUrl} alt="Proof" className="mt-2 max-h-32 rounded-md border" />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button disabled={payMutation.isPending} onClick={() => payDialog && payMutation.mutate(payDialog.id)}>
              {payMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
