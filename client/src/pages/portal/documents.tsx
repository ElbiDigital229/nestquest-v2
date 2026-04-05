import { useState, useMemo } from "react";
import { useFilters } from "@/hooks/use-filters";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  FileText,
  Building,
  User,
  Clock,
  AlertTriangle,
  ExternalLink,
  FileCheck,
  FileX,
} from "lucide-react";

interface Document {
  id: string;
  documentType: string;
  name: string | null;
  description: string | null;
  fileUrl: string | null;
  hasExpiry: boolean;
  expiryDate: string | null;
  createdAt: string;
  source: "property" | "user";
  propertyId: string | null;
  propertyName: string | null;
  buildingName: string | null;
  unitNumber: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
}

interface DocumentsResponse {
  propertyDocuments: Document[];
  userDocuments: Document[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  title_deed: "Title Deed",
  spa: "Sale & Purchase Agreement",
  noc: "NOC",
  dtcm: "DTCM Permit",
  oqood: "Oqood",
  tenancy_contract: "Tenancy Contract",
  mortgage_agreement: "Mortgage Agreement",
  emirates_id: "Emirates ID",
  passport: "Passport",
  trade_license: "Trade License",
  visa: "UAE Visa",
  other: "Other",
};

const ROLE_LABELS: Record<string, string> = {
  PROPERTY_MANAGER: "Property Manager",
  PROPERTY_OWNER: "Property Owner",
  TENANT: "Tenant",
  GUEST: "Guest",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400000);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ExpiryBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-xs text-muted-foreground">No expiry</span>;
  const days = daysUntil(dateStr);
  if (days === null) return null;

  if (days <= 0) {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Expired {Math.abs(days)}d ago
      </Badge>
    );
  }
  if (days <= 30) {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">
        {days}d left
      </Badge>
    );
  }
  if (days <= 90) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">
        {days}d left
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">
      {days}d left
    </Badge>
  );
}

export default function DocumentsPage() {
  const { data, isLoading } = useQuery<DocumentsResponse>({
    queryKey: ["/st-properties/documents"],
    queryFn: () => api.get("/st-properties/documents"),
  });

  const allDocs = useMemo(() => {
    if (!data) return [];
    return [...data.propertyDocuments, ...data.userDocuments];
  }, [data]);

  const { search, setSearch, filters, setFilter, filtered: filteredDocs } = useFilters(allDocs, {
    searchFields: ["name", "documentType", "userName", "propertyName", "buildingName"],
    filterFields: { source: "all", documentType: "all", expiry: "all" },
    customFilter: (doc, filters) => {
      if (filters.expiry !== "all") {
        const days = daysUntil(doc.expiryDate);
        if (filters.expiry === "expired" && (days === null || days > 0)) return false;
        if (filters.expiry === "30" && (days === null || days <= 0 || days > 30)) return false;
        if (filters.expiry === "90" && (days === null || days <= 0 || days > 90)) return false;
      }
      return true;
    },
  });

  // Stats
  const stats = useMemo(() => {
    let total = allDocs.length;
    let expiring = 0;
    let expired = 0;
    let propertyCount = 0;
    let userCount = 0;

    for (const doc of allDocs) {
      if (doc.source === "property") propertyCount++;
      else userCount++;
      const days = daysUntil(doc.expiryDate);
      if (days !== null) {
        if (days <= 0) expired++;
        else if (days <= 90) expiring++;
      }
    }

    return { total, expiring, expired, propertyCount, userCount };
  }, [allDocs]);

  // Unique document types for filter
  const docTypes = useMemo(() => {
    const types = new Set(allDocs.map((d) => d.documentType));
    return Array.from(types).sort();
  }, [allDocs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Documents
        </h1>
        <p className="text-muted-foreground mt-1">
          All documents across your properties and linked users
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-blue-50">
              <FileCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total</p>
              <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-emerald-50">
              <Building className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Property Docs</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.propertyCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-amber-50">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Expiring (90d)</p>
              <p className="text-2xl font-bold text-amber-700">{stats.expiring}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg p-2.5 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Expired</p>
              <p className="text-2xl font-bold text-red-700">{stats.expired}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filters.source} onValueChange={(v) => setFilter("source", v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="property">Property Docs</SelectItem>
                <SelectItem value="user">User Docs</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.documentType} onValueChange={(v) => setFilter("documentType", v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {docTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOC_TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.expiry} onValueChange={(v) => setFilter("expiry", v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Expiry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="30">Within 30d</SelectItem>
                <SelectItem value="90">Within 90d</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <FileX className="h-8 w-8" />
              <p>No documents found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium px-4 py-3">Document</th>
                    <th className="text-left font-medium px-4 py-3">Type</th>
                    <th className="text-left font-medium px-4 py-3">Associated With</th>
                    <th className="text-left font-medium px-4 py-3">Expiry</th>
                    <th className="text-left font-medium px-4 py-3">Uploaded</th>
                    <th className="text-left font-medium px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <tr key={`${doc.source}-${doc.id}`} className="border-b last:border-0 hover:bg-accent/50 transition-colors">
                      {/* Document name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium">{doc.name || DOC_TYPE_LABELS[doc.documentType] || doc.documentType}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[250px]">{doc.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Source badge */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]">
                          {doc.source === "property" ? (
                            <><Building className="h-3 w-3 mr-1" />Property</>
                          ) : (
                            <><User className="h-3 w-3 mr-1" />User</>
                          )}
                        </Badge>
                      </td>

                      {/* Associated with */}
                      <td className="px-4 py-3">
                        {doc.source === "property" ? (
                          <div>
                            <p className="font-medium text-sm">{doc.propertyName || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {[doc.buildingName, doc.unitNumber ? `Unit ${doc.unitNumber}` : null].filter(Boolean).join(", ") || "—"}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-sm">{doc.userName || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.userEmail}
                              {doc.userRole && (
                                <span className="ml-1">({ROLE_LABELS[doc.userRole] || doc.userRole})</span>
                              )}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Expiry */}
                      <td className="px-4 py-3">
                        {doc.hasExpiry ? (
                          <div className="space-y-1">
                            <p className="text-sm">{formatDate(doc.expiryDate)}</p>
                            <ExpiryBadge dateStr={doc.expiryDate} />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No expiry</span>
                        )}
                      </td>

                      {/* Upload date */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </td>

                      {/* View */}
                      <td className="px-4 py-3">
                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </td>
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
