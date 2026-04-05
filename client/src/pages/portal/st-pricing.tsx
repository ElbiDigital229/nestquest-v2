import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
  BedDouble,
  Loader2,
  CalendarDays,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StProperty {
  id: string;
  publicName: string | null;
  bedrooms: number | null;
  nightlyRate: string | null;
  weekendRate: string | null;
  minimumStay: number | null;
  cleaningFee: string | null;
  status: string;
  coverPhotoUrl: string | null;
  city: string | null;
  area: string | null;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StPricing() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: properties = [], isLoading } = useQuery<StProperty[]>({
    queryKey: ["/st-properties"],
    queryFn: () => api.get("/st-properties"),
  });

  const filteredProperties = useMemo(() => {
    const activeProps = (properties as any[]).filter((p: any) => p.status === "active");
    if (!searchQuery.trim()) return activeProps;
    const q = searchQuery.toLowerCase();
    return activeProps.filter(
      (p: any) =>
        p.publicName?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.area?.toLowerCase().includes(q)
    );
  }, [properties, searchQuery]);

  const selectedProperty = useMemo(
    () => filteredProperties.find((p: any) => p.id === selectedPropertyId) || filteredProperties[0],
    [filteredProperties, selectedPropertyId]
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left Panel — Property List */}
      <div className="w-80 border-r flex flex-col shrink-0 bg-muted/30">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Pricing</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground px-4">
              No active properties found
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredProperties.map((p: any) => {
                const isSelected = selectedProperty?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPropertyId(p.id)}
                    className={`w-full text-left rounded-lg px-3 py-3 transition-colors ${
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <p className="font-medium text-sm truncate">
                      {p.publicName || "Unnamed Property"}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-3 w-3" />
                        {p.bedrooms ?? "—"} BR
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        AED {p.nightlyRate ?? "—"}/night
                      </span>
                    </div>
                    {(p.city || p.area) && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[p.area, p.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel — Calendar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedProperty ? (
          <PricingCalendar property={selectedProperty} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a property to manage pricing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pricing Calendar Component ─────────────────────────────────────────────

function PricingCalendar({ property }: { property: StProperty }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);

  // Dialogs
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    price: "",
    weekdayPrice: "",
    weekendPrice: "",
    minStay: "",
    notes: "",
  });
  const [singleEdit, setSingleEdit] = useState<{
    date: string;
    price: string;
    minStay: string;
  } | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");

  // Date range
  const startDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-01`;
  const endD = new Date(currentMonth.year, currentMonth.month + 1, 0);
  const endDate = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;

  const { data } = useQuery<any>({
    queryKey: [`/st-properties/${property.id}/calendar-pricing`, startDate, endDate],
    queryFn: () =>
      api.get(`/st-properties/${property.id}/calendar-pricing?from=${startDate}&to=${endDate}`),
  });

  // Mutations
  const bulkMut = useMutation({
    mutationFn: () => {
      const sorted = [...selectedDates].sort();
      const body: any = { startDate: sorted[0], endDate: sorted[sorted.length - 1] };
      if (bulkForm.price) body.price = bulkForm.price;
      if (bulkForm.weekdayPrice) body.weekdayPrice = bulkForm.weekdayPrice;
      if (bulkForm.weekendPrice) body.weekendPrice = bulkForm.weekendPrice;
      if (bulkForm.minStay) body.minStay = parseInt(bulkForm.minStay);
      if (bulkForm.notes) body.notes = bulkForm.notes;
      return api.put(`/st-properties/${property.id}/pricing`, body);
    },
    onSuccess: () => {
      toast({ title: "Pricing updated" });
      queryClient.invalidateQueries({
        queryKey: [`/st-properties/${property.id}/calendar-pricing`],
      });
      setBulkOpen(false);
      setSelectedDates([]);
      setBulkForm({ price: "", weekdayPrice: "", weekendPrice: "", minStay: "", notes: "" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const singleMut = useMutation({
    mutationFn: () =>
      api.patch(`/st-properties/${property.id}/pricing/${singleEdit!.date}`, {
        price: singleEdit!.price,
        minStay: singleEdit!.minStay ? parseInt(singleEdit!.minStay) : null,
      }),
    onSuccess: () => {
      toast({ title: "Price updated" });
      queryClient.invalidateQueries({
        queryKey: [`/st-properties/${property.id}/calendar-pricing`],
      });
      setSingleEdit(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const resetMut = useMutation({
    mutationFn: () => {
      const sorted = [...selectedDates].sort();
      return api.delete(
        `/st-properties/${property.id}/pricing?startDate=${sorted[0]}&endDate=${sorted[sorted.length - 1]}`
      );
    },
    onSuccess: () => {
      toast({ title: "Pricing reset to defaults" });
      queryClient.invalidateQueries({
        queryKey: [`/st-properties/${property.id}/calendar-pricing`],
      });
      setSelectedDates([]);
    },
  });

  const blockMut = useMutation({
    mutationFn: () => {
      const sorted = [...selectedDates].sort();
      return api.post("/bookings/block-dates", {
        propertyId: property.id,
        startDate: sorted[0],
        endDate: sorted[sorted.length - 1],
        reason: blockReason || "Owner block",
      });
    },
    onSuccess: () => {
      toast({ title: "Dates blocked" });
      queryClient.invalidateQueries({
        queryKey: [`/st-properties/${property.id}/calendar-pricing`],
      });
      setBlockOpen(false);
      setBlockReason("");
      setSelectedDates([]);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // Build calendar data
  const defaults = data?.defaults || {};
  const defaultNightly = parseFloat(defaults.nightlyRate || "0");
  const defaultWeekend = parseFloat(defaults.weekendRate || defaults.nightlyRate || "0");

  const pricingMap = new Map<string, any>();
  (data?.pricing || []).forEach((p: any) => {
    const d = typeof p.date === "string" ? p.date.slice(0, 10) : fmtDate(new Date(p.date));
    pricingMap.set(d, p);
  });

  const bookingMap = new Map<string, any>();
  (data?.bookings || []).forEach((b: any) => {
    const startStr = typeof b.checkIn === "string" ? b.checkIn.slice(0, 10) : b.checkIn;
    const endStr = typeof b.checkOut === "string" ? b.checkOut.slice(0, 10) : b.checkOut;
    const start = new Date(startStr + "T12:00:00");
    const end = new Date(endStr + "T12:00:00");
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      bookingMap.set(fmtDate(d), b);
    }
  });

  const blockedSet = new Set<string>();
  const blockedMap = new Map<string, any>();
  (data?.blocked || []).forEach((bl: any) => {
    const startStr = typeof bl.startDate === "string" ? bl.startDate.slice(0, 10) : bl.startDate;
    const endStr = typeof bl.endDate === "string" ? bl.endDate.slice(0, 10) : bl.endDate;
    const start = new Date(startStr + "T12:00:00");
    const end = new Date(endStr + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      blockedSet.add(fmtDate(d));
      blockedMap.set(fmtDate(d), bl);
    }
  });

  const firstDay = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const today = fmtDate(new Date());

  const prevMonth = () =>
    setCurrentMonth((m) =>
      m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }
    );
  const nextMonth = () =>
    setCurrentMonth((m) =>
      m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }
    );

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  // Drag selection helpers
  const handleMouseDown = (dateStr: string, isPast: boolean, isBooked: boolean) => {
    if (isPast || isBooked) return;
    setIsDragging(true);
    setDragStart(dateStr);
    toggleDate(dateStr);
  };

  const handleMouseEnter = (dateStr: string, isPast: boolean, isBooked: boolean) => {
    if (!isDragging || isPast || isBooked || !dragStart) return;
    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) return prev;
      return [...prev, dateStr].sort();
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Booking source color map
  const getBookingBg = (booking: any) => {
    const source = (booking.source || booking.channel || "nestquest").toLowerCase();
    if (source.includes("airbnb")) return "bg-rose-50 border-rose-200";
    if (source.includes("booking")) return "bg-indigo-50 border-indigo-200";
    return "bg-blue-50 border-blue-200";
  };

  const getBookingLabel = (booking: any) => {
    const source = (booking.source || booking.channel || "").toLowerCase();
    if (source.includes("airbnb")) return "Airbnb";
    if (source.includes("booking")) return "Booking.com";
    return "NestQuest";
  };

  // Reset selected dates when property changes
  const [prevPropId, setPrevPropId] = useState(property.id);
  if (property.id !== prevPropId) {
    setPrevPropId(property.id);
    setSelectedDates([]);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onMouseUp={handleMouseUp}>
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">{property.publicName || "Unnamed Property"}</h2>
            <p className="text-sm text-muted-foreground">
              Base Rates: AED {defaultNightly} weekday / AED {defaultWeekend} weekend
              {defaults.cleaningFee && ` | Cleaning: AED ${defaults.cleaningFee}`}
              {defaults.minimumStay && ` | Min Stay: ${defaults.minimumStay}n`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center">{monthName}</span>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-white border border-gray-300" />
            Weekday
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-50 border border-green-300" />
            Weekend
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-50 border border-amber-300" />
            Custom Rate
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-200 border border-gray-400" />
            Blocked
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-50 border border-blue-300" />
            NestQuest
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-rose-50 border border-rose-300" />
            Airbnb
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-indigo-50 border border-indigo-300" />
            Booking.com
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-primary/20 border border-primary" />
            Selected
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="grid grid-cols-7 gap-1 select-none">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-muted-foreground py-2"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`e-${i}`} className="min-h-[84px]" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayOfWeek = new Date(currentMonth.year, currentMonth.month, day).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sat (6), Sun (0)
            const booking = bookingMap.get(dateStr);
            const isBlocked = blockedSet.has(dateStr);
            const customPrice = pricingMap.get(dateStr);
            const isSelected = selectedDates.includes(dateStr);
            const isPast = dateStr < today;

            const price = customPrice
              ? parseFloat(customPrice.price)
              : isWeekend
                ? defaultWeekend
                : defaultNightly;
            const isCustom = !!customPrice;

            // Color coding per spec
            let bg = isWeekend
              ? "bg-green-50 border-green-200 hover:bg-green-100"
              : "bg-white border-gray-200 hover:bg-gray-50";
            if (isCustom && !booking && !isBlocked) bg = "bg-amber-50 border-amber-200 hover:bg-amber-100";
            if (isBlocked) bg = "bg-gray-200 border-gray-400";
            if (booking) bg = getBookingBg(booking);
            if (isSelected) bg = "bg-primary/10 border-primary ring-1 ring-primary";
            if (isPast) bg = "bg-gray-50 border-gray-200 opacity-50";

            return (
              <div
                key={dateStr}
                className={`min-h-[84px] border rounded-md p-1.5 cursor-pointer transition-colors text-xs ${bg}`}
                onMouseDown={() => handleMouseDown(dateStr, isPast, !!booking)}
                onMouseEnter={() => handleMouseEnter(dateStr, isPast, !!booking)}
                onDoubleClick={() => {
                  if (isPast || booking || isBlocked) return;
                  setSingleEdit({
                    date: dateStr,
                    price: String(price),
                    minStay: customPrice?.minStay?.toString() || "",
                  });
                }}
              >
                <div className="flex justify-between items-start">
                  <span className={`font-semibold ${dateStr === today ? "text-primary" : ""}`}>
                    {day}
                  </span>
                  {isWeekend && !booking && !isBlocked && (
                    <span className="text-[9px] text-muted-foreground">WE</span>
                  )}
                </div>
                <p
                  className={`font-bold mt-0.5 ${isCustom ? "text-amber-700" : "text-gray-700"}`}
                >
                  {price > 0 ? `${price}` : "—"}
                </p>
                {booking && (
                  <div className="mt-0.5">
                    <p className="truncate text-[10px] font-medium text-blue-700">
                      {booking.guestName}
                    </p>
                    <Badge className="text-[8px] h-3.5 bg-blue-100/60 text-blue-800 border-0">
                      {getBookingLabel(booking)}
                    </Badge>
                  </div>
                )}
                {isBlocked && (
                  <p className="text-[10px] text-gray-600 mt-0.5 font-medium">Blocked</p>
                )}
                {customPrice?.minStay && (
                  <p className="text-[9px] text-muted-foreground">Min {customPrice.minStay}n</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Bar */}
      {selectedDates.length > 0 && (
        <div className="px-6 py-3 border-t bg-muted/40 flex items-center gap-3 shrink-0">
          <Badge variant="secondary" className="text-sm">
            {selectedDates.length} date{selectedDates.length > 1 ? "s" : ""} selected
          </Badge>
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            <DollarSign className="h-4 w-4 mr-1" />
            Set Custom Rate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBlockOpen(true)}
          >
            Block Dates
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
          >
            Reset to Default
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedDates([])}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Bulk Pricing Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Pricing — {selectedDates.length} days</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedDates[0]} to {selectedDates[selectedDates.length - 1]}
          </p>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Flat Price (AED) — applies to all days</Label>
              <Input
                type="number"
                value={bulkForm.price}
                onChange={(e) =>
                  setBulkForm((f) => ({
                    ...f,
                    price: e.target.value,
                    weekdayPrice: "",
                    weekendPrice: "",
                  }))
                }
                placeholder="e.g. 1500"
              />
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Or set different weekday/weekend prices:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Weekday Price</Label>
                <Input
                  type="number"
                  value={bulkForm.weekdayPrice}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      weekdayPrice: e.target.value,
                      price: "",
                    }))
                  }
                  placeholder="Sun-Thu"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Weekend Price</Label>
                <Input
                  type="number"
                  value={bulkForm.weekendPrice}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      weekendPrice: e.target.value,
                      price: "",
                    }))
                  }
                  placeholder="Fri-Sat"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Minimum Stay (nights)</Label>
              <Input
                type="number"
                value={bulkForm.minStay}
                onChange={(e) => setBulkForm((f) => ({ ...f, minStay: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={bulkForm.notes}
                onChange={(e) => setBulkForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Peak season, Eid holiday"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={bulkMut.isPending || (!bulkForm.price && !bulkForm.weekdayPrice)}
              onClick={() => bulkMut.mutate()}
            >
              {bulkMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply Pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Date Edit Dialog */}
      <Dialog open={!!singleEdit} onOpenChange={(o) => !o && setSingleEdit(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Price — {singleEdit?.date}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Price (AED)</Label>
              <Input
                type="number"
                value={singleEdit?.price || ""}
                onChange={(e) =>
                  setSingleEdit((prev) =>
                    prev ? { ...prev, price: e.target.value } : null
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stay (nights)</Label>
              <Input
                type="number"
                value={singleEdit?.minStay || ""}
                onChange={(e) =>
                  setSingleEdit((prev) =>
                    prev ? { ...prev, minStay: e.target.value } : null
                  )
                }
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSingleEdit(null)}>
              Cancel
            </Button>
            <Button
              disabled={singleMut.isPending || !singleEdit?.price}
              onClick={() => singleMut.mutate()}
            >
              {singleMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Dates Dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block Dates — {selectedDates.length} days</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedDates[0]} to {selectedDates[selectedDates.length - 1]}
          </p>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Owner stay, Maintenance"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button disabled={blockMut.isPending} onClick={() => blockMut.mutate()}>
              {blockMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Block Dates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
