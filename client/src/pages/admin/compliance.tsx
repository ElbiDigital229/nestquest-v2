import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/role-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Search,
  FileCheck,
  AlertTriangle,
  Users,
  Clock,
  FileX,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */

interface DocumentType {
  id: string;
  slug: string;
  label: string;
  hasExpiry: boolean;
  applicableRoles: string[] | null;
  requiredForRoles: string[] | null;
  sortOrder: number;
  isActive: boolean;
}

interface UserDocument {
  documentTypeId: string;
  slug: string;
  label: string;
  fileUrl: string | null;
  documentNumber: string | null;
  expiryDate: string | null;
  hasExpiry: boolean;
}

interface ComplianceRow {
  guestId: string;
  fullName: string;
  email: string;
  role: string;
  documents: UserDocument[];
}

interface FlattenedDoc {
  guestId: string;
  fullName: string;
  email: string;
  role: string;
  docTypeLabel: string;
  expiryDate: string | null;
  daysLeft: number | null;
  fileUrl: string | null;
}

/* ── Helpers ───────────────────────────────────────────── */

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

function isDocApplicable(docType: DocumentType, userRole: string): boolean {
  const roles = docType.applicableRoles || docType.requiredForRoles;
  return !roles || roles.includes(userRole);
}

function isDocRequired(docType: DocumentType, userRole: string): boolean {
  const roles = docType.requiredForRoles;
  if (!roles) return true;
  return roles.includes(userRole);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ── DocCell (for User View table) ─────────────────────── */

function DocCell({
  doc,
  docType,
  userRole,
}: {
  doc: UserDocument | undefined;
  docType: DocumentType;
  userRole: string;
}) {
  const roles = docType.applicableRoles || docType.requiredForRoles;
  if (roles && !roles.includes(userRole)) {
    return (
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">N/A</span>
      </td>
    );
  }

  if (!doc || !doc.fileUrl) {
    return (
      <td className="px-4 py-3">
        <Badge
          variant="secondary"
          className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]"
        >
          Missing
        </Badge>
      </td>
    );
  }

  const days = docType.hasExpiry ? daysUntil(doc.expiryDate) : null;

  let expiryLabel = "";
  let expiryColor = "";
  if (docType.hasExpiry && days !== null) {
    if (days <= 0) {
      expiryLabel = `Expired (${Math.abs(days)}d ago)`;
      expiryColor = "text-red-800 font-semibold";
    } else if (days < 30) {
      expiryLabel = `${days}d`;
      expiryColor = "text-red-600 font-medium";
    } else if (days <= 90) {
      expiryLabel = `${days}d`;
      expiryColor = "text-yellow-600 font-medium";
    } else {
      expiryLabel = `${days}d`;
      expiryColor = "text-green-600 font-medium";
    }
  }

  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]"
        >
          Uploaded
        </Badge>
        {expiryLabel && (
          <span className={`text-xs ${expiryColor}`}>{expiryLabel}</span>
        )}
      </div>
    </td>
  );
}

/* ── Collapsible Section ───────────────────────────────── */

function UrgencySection({
  title,
  count,
  items,
  borderColor,
  headerBg,
  onNavigate,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  items: FlattenedDoc[];
  borderColor: string;
  headerBg: string;
  onNavigate: (guestId: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border rounded-lg overflow-hidden border-l-4 ${borderColor}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3 ${headerBg} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm">{title}</span>
          <Badge variant="secondary" className="text-[10px]">
            {count}
          </Badge>
        </div>
      </button>

      {open && (
        <div className="divide-y">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              None
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={`${item.guestId}-${item.docTypeLabel}-${idx}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => onNavigate(item.guestId)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {item.fullName || "\u2014"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.email}
                  </p>
                </div>

                <div className="px-4 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {item.docTypeLabel}
                  </Badge>
                </div>

                <div className="text-right shrink-0 min-w-[120px]">
                  <p className="text-sm">{formatDate(item.expiryDate)}</p>
                  {item.daysLeft !== null && (
                    <p
                      className={`text-xs font-medium ${
                        item.daysLeft <= 0
                          ? "text-red-600"
                          : item.daysLeft <= 30
                            ? "text-amber-600"
                            : "text-yellow-600"
                      }`}
                    >
                      {item.daysLeft <= 0
                        ? `Expired ${Math.abs(item.daysLeft)}d ago`
                        : `${item.daysLeft}d remaining`}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Stat Card ─────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "blue" | "red" | "amber";
}) {
  const colors = {
    blue: {
      bg: "bg-blue-50",
      icon: "text-blue-600",
      value: "text-blue-700",
    },
    red: {
      bg: "bg-red-50",
      icon: "text-red-600",
      value: "text-red-700",
    },
    amber: {
      bg: "bg-amber-50",
      icon: "text-amber-600",
      value: "text-amber-700",
    },
  };
  const c = colors[color];

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2.5 ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Page ──────────────────────────────────────────────── */

export default function CompliancePage() {
  const [, navigate] = useLocation();

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [customDays, setCustomDays] = useState(45);

  // View mode
  const [viewMode, setViewMode] = useState<"urgency" | "user">("urgency");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Compute effective expiryWithin value
  const expiryWithin =
    expiryFilter === "all"
      ? undefined
      : expiryFilter === "expired"
        ? 0
        : expiryFilter === "custom"
          ? customDays
          : Number(expiryFilter);

  // Fetch document types
  const { data: documentTypes = [] } = useQuery<DocumentType[]>({
    queryKey: ["/admin/document-types"],
    queryFn: () => api.get("/admin/document-types"),
  });

  // Fetch compliance data
  const { data: rows = [], isLoading } = useQuery<ComplianceRow[]>({
    queryKey: [
      "/admin/compliance",
      { search: debouncedSearch, role: roleFilter, docType: docTypeFilter, expiryWithin },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (docTypeFilter !== "all") params.set("docType", docTypeFilter);
      if (expiryWithin !== undefined) params.set("expiryWithin", String(expiryWithin));
      const qs = params.toString();
      return api.get(`/admin/compliance${qs ? `?${qs}` : ""}`);
    },
  });

  /* ── Stats ────────────────────────────────────────────── */

  const stats = useMemo(() => {
    let missingCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    for (const row of rows) {
      for (const docType of documentTypes) {
        if (!isDocApplicable(docType, row.role)) continue;
        if (!isDocRequired(docType, row.role)) continue;

        const doc = row.documents.find((d) => d.documentTypeId === docType.id);
        if (!doc || !doc.fileUrl) {
          missingCount++;
          continue;
        }

        if (docType.hasExpiry) {
          const days = daysUntil(doc.expiryDate);
          if (days !== null) {
            if (days <= 0) expiredCount++;
            else if (days <= 30) expiringSoonCount++;
          }
        }
      }
    }

    return {
      totalUsers: rows.length,
      missing: missingCount,
      expiringSoon: expiringSoonCount,
      expired: expiredCount,
    };
  }, [rows, documentTypes]);

  /* ── Flattened Docs for Urgency View ──────────────────── */

  const flatDocs = useMemo(() => {
    const result: FlattenedDoc[] = [];

    for (const row of rows) {
      for (const docType of documentTypes) {
        if (!isDocApplicable(docType, row.role)) continue;
        if (!docType.hasExpiry) continue;

        const doc = row.documents.find((d) => d.documentTypeId === docType.id);
        if (!doc || !doc.fileUrl) continue;

        const days = daysUntil(doc.expiryDate);
        if (days === null) continue;
        if (days > 90) continue;

        result.push({
          guestId: row.guestId,
          fullName: row.fullName,
          email: row.email,
          role: row.role,
          docTypeLabel: docType.label,
          expiryDate: doc.expiryDate,
          daysLeft: days,
          fileUrl: doc.fileUrl,
        });
      }
    }

    result.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
    return result;
  }, [rows, documentTypes]);

  const expiredDocs = useMemo(
    () => flatDocs.filter((d) => d.daysLeft !== null && d.daysLeft <= 0),
    [flatDocs]
  );
  const expiringDocs = useMemo(
    () =>
      flatDocs.filter(
        (d) => d.daysLeft !== null && d.daysLeft >= 1 && d.daysLeft <= 30
      ),
    [flatDocs]
  );
  const expiring90Docs = useMemo(
    () =>
      flatDocs.filter(
        (d) => d.daysLeft !== null && d.daysLeft >= 31 && d.daysLeft <= 90
      ),
    [flatDocs]
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileCheck className="h-6 w-6" />
          Document Compliance
        </h1>
        <p className="text-muted-foreground mt-1">
          Track document upload status and expiry dates across all users
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Missing Documents"
          value={stats.missing}
          icon={FileX}
          color="red"
        />
        <StatCard
          label="Expiring Soon"
          value={stats.expiringSoon}
          icon={Clock}
          color="amber"
        />
        <StatCard
          label="Expired"
          value={stats.expired}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <Card>
        {/* Filter Bar + View Toggle */}
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <CardTitle className="text-base">Compliance Overview</CardTitle>

            {/* View Mode Toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("urgency")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === "urgency"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                By Urgency
              </button>
              <button
                type="button"
                onClick={() => setViewMode("user")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l ${
                  viewMode === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                By User
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Role filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="GUEST">Guest</SelectItem>
                <SelectItem value="PROPERTY_MANAGER">Property Manager</SelectItem>
                <SelectItem value="PROPERTY_OWNER">Property Owner</SelectItem>
                <SelectItem value="TENANT">Tenant</SelectItem>
              </SelectContent>
            </Select>

            {/* Document Type filter */}
            <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Documents</SelectItem>
                {documentTypes.map((dt) => (
                  <SelectItem key={dt.id} value={dt.slug}>
                    {dt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Expiry filter */}
            <Select value={expiryFilter} onValueChange={setExpiryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Expiry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom days input */}
            {expiryFilter === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  value={customDays}
                  onChange={(e) => setCustomDays(Number(e.target.value) || 1)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground font-medium mr-1">
              Quick filters:
            </span>
            <Button
              variant={expiryFilter === "expired" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setExpiryFilter(expiryFilter === "expired" ? "all" : "expired")
              }
            >
              Expired
            </Button>
            <Button
              variant={expiryFilter === "30" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setExpiryFilter(expiryFilter === "30" ? "all" : "30")
              }
            >
              &le; 30 Days
            </Button>
            <Button
              variant={expiryFilter === "90" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setExpiryFilter(expiryFilter === "90" ? "all" : "90")
              }
            >
              &le; 90 Days
            </Button>
            <Button
              variant={expiryFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setExpiryFilter("all")}
            >
              All
            </Button>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <AlertTriangle className="h-5 w-5" />
              <p>No users found</p>
            </div>
          ) : viewMode === "urgency" ? (
            /* ── Urgency View ──────────────────────────────── */
            <div className="space-y-4">
              <UrgencySection
                title="Expired"
                count={expiredDocs.length}
                items={expiredDocs}
                borderColor="border-l-red-500"
                headerBg="bg-red-50"
                onNavigate={(id) => navigate(`/admin/users/${id}`)}
              />
              <UrgencySection
                title="Expiring Within 30 Days"
                count={expiringDocs.length}
                items={expiringDocs}
                borderColor="border-l-amber-500"
                headerBg="bg-amber-50"
                onNavigate={(id) => navigate(`/admin/users/${id}`)}
              />
              <UrgencySection
                title="Expiring Within 90 Days"
                count={expiring90Docs.length}
                items={expiring90Docs}
                borderColor="border-l-yellow-500"
                headerBg="bg-yellow-50"
                onNavigate={(id) => navigate(`/admin/users/${id}`)}
              />
            </div>
          ) : (
            /* ── User View (table) ─────────────────────────── */
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                      Name
                    </th>
                    <th className="text-left font-medium px-4 py-3 whitespace-nowrap">
                      Role
                    </th>
                    {documentTypes.map((dt) => (
                      <th
                        key={dt.id}
                        className="text-left font-medium px-4 py-3 whitespace-nowrap"
                      >
                        {dt.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.guestId}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/users/${row.guestId}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.fullName || "\u2014"}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {ROLE_LABELS[row.role] || row.role}
                        </Badge>
                      </td>
                      {documentTypes.map((dt) => {
                        const doc = row.documents.find(
                          (d) => d.documentTypeId === dt.id
                        );
                        return (
                          <DocCell
                            key={dt.id}
                            doc={doc}
                            docType={dt}
                            userRole={row.role}
                          />
                        );
                      })}
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
