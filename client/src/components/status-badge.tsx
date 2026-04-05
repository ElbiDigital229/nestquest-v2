import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const BOOKING_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  requested: { label: "Requested", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800 border-blue-300" },
  checked_in: { label: "Checked In", color: "bg-green-100 text-green-800 border-green-300" },
  checked_out: { label: "Checked Out", color: "bg-orange-100 text-orange-800 border-orange-300" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 border-red-300" },
  declined: { label: "Declined", color: "bg-gray-100 text-gray-800 border-gray-300" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500 border-gray-300" },
};

const KYC_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  verified: { label: "Verified", color: "bg-green-100 text-green-800 border-green-300" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-300" },
  not_submitted: { label: "Not Submitted", color: "bg-gray-100 text-gray-500 border-gray-300" },
};

const PROPERTY_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-100 text-green-800 border-green-300" },
  inactive: { label: "Inactive", color: "bg-gray-100 text-gray-500 border-gray-300" },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  draft: { label: "Draft", color: "bg-blue-100 text-blue-800 border-blue-300" },
  suspended: { label: "Suspended", color: "bg-red-100 text-red-800 border-red-300" },
};

export function BookingStatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = BOOKING_STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-800 border-gray-300" };
  return <Badge variant="outline" className={cn("text-xs font-medium border", cfg.color, className)}>{cfg.label}</Badge>;
}

export function KycStatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = KYC_STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-800 border-gray-300" };
  return <Badge variant="outline" className={cn("text-xs font-medium border", cfg.color, className)}>{cfg.label}</Badge>;
}

export function PropertyStatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = PROPERTY_STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-800 border-gray-300" };
  return <Badge variant="outline" className={cn("text-xs font-medium border", cfg.color, className)}>{cfg.label}</Badge>;
}
