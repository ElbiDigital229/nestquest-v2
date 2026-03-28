export const ROLE_SLUG_MAP: Record<string, string> = {
  guest: "GUEST",
  "property-manager": "PROPERTY_MANAGER",
  "property-owner": "PROPERTY_OWNER",
  tenant: "TENANT",
};

export const ROLE_LABELS: Record<string, string> = {
  GUEST: "Guest",
  PROPERTY_MANAGER: "Property Manager",
  PROPERTY_OWNER: "Property Owner",
  TENANT: "Tenant",
  SUPER_ADMIN: "Super Admin",
};

export function slugToRole(slug: string): string | undefined {
  return ROLE_SLUG_MAP[slug];
}

export function roleToSlug(role: string): string {
  return role.toLowerCase().replace(/_/g, "-");
}

// ── Design System: Consistent Badge Styling ──────────────

/** Capitalize first letter of each word */
export function capitalize(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** KYC status badge: variant + className for consistent colors */
export function kycBadgeProps(status: string): { variant: "default" | "secondary" | "destructive" | "outline"; className: string; label: string } {
  const s = status?.toLowerCase();
  switch (s) {
    case "verified":
      return { variant: "default", className: "bg-blue-600 hover:bg-blue-600 text-white border-transparent", label: "Verified" };
    case "pending":
      return { variant: "secondary", className: "", label: "Pending" };
    case "rejected":
      return { variant: "destructive", className: "", label: "Rejected" };
    default:
      return { variant: "outline", className: "", label: capitalize(status || "Unknown") };
  }
}

/** Account status badge: variant + className for consistent colors */
export function statusBadgeProps(status: string): { variant: "default" | "secondary" | "destructive" | "outline"; className: string; label: string } {
  const s = status?.toLowerCase();
  switch (s) {
    case "active":
      return { variant: "default", className: "bg-emerald-500 hover:bg-emerald-500 text-white border-transparent", label: "Active" };
    case "suspended":
      return { variant: "destructive", className: "", label: "Suspended" };
    case "inactive":
      return { variant: "secondary", className: "", label: "Inactive" };
    default:
      return { variant: "outline", className: "", label: capitalize(status || "Unknown") };
  }
}
