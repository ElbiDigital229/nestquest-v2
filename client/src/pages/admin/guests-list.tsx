import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { ROLE_LABELS, kycBadgeProps, statusBadgeProps } from "@/lib/role-utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserX,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GuestListItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  nationality: string;
  countryOfResidence: string;
  emiratesIdNumber: string;
  kycStatus: string;
  userStatus: string;
  role: string;
  createdAt: string;
}

interface GuestsResponse {
  guests: GuestListItem[];
  total: number;
  page: number;
  limit: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Badge helpers now imported from role-utils (kycBadgeProps, statusBadgeProps)

type SortField = "fullName" | "email" | "nationality" | "kycStatus" | "userStatus" | "createdAt";
type SortOrder = "asc" | "desc";

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminGuestsList() {
  const [, navigate] = useLocation();

  // Search & pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [kycStatus, setKycStatus] = useState("");
  const [userStatus, setUserStatus] = useState("");
  const [nationality, setNationality] = useState("");
  const [role, setRole] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const activeFilterCount = [kycStatus, userStatus, nationality, role, dateFrom, dateTo].filter(Boolean).length;

  const { data: nationalitiesData } = useQuery<string[]>({
    queryKey: ["/admin/nationalities"],
    queryFn: () => api.get("/admin/nationalities"),
  });

  const { data, isLoading } = useQuery<GuestsResponse>({
    queryKey: ["/admin/users", page, search, kycStatus, userStatus, nationality, role, dateFrom, dateTo, sortBy, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sortBy,
        sortOrder,
      });
      if (search.trim()) params.set("search", search.trim());
      if (kycStatus) params.set("kycStatus", kycStatus);
      if (userStatus) params.set("userStatus", userStatus);
      if (nationality.trim()) params.set("nationality", nationality.trim());
      if (role) params.set("role", role);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      return api.get(`/admin/users?${params.toString()}`);
    },
  });

  const guests = data?.guests || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value === "_all" ? "" : value);
    setPage(1);
  };

  const clearFilters = () => {
    setKycStatus("");
    setUserStatus("");
    setNationality("");
    setRole("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/50" />;
    return sortOrder === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Users</h1>
          <Badge variant="secondary" className="text-sm">{total}</Badge>
        </div>
      </div>

      <Card>
        {/* Search + Filter bar */}
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or phone..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-border hidden sm:block" />

            {/* Filters toggle */}
            <Button
              variant={showFilters ? "default" : "outline"}
              className="h-10 gap-2 px-4"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-primary-foreground text-primary text-xs font-semibold px-1">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* Sort selector */}
            <Select
              value={sortBy}
              onValueChange={(v) => { setSortBy(v as SortField); setPage(1); }}
            >
              <SelectTrigger className="h-10 w-[160px] text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Date Joined</SelectItem>
                <SelectItem value="fullName">Name</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="nationality">Nationality</SelectItem>
                <SelectItem value="kycStatus">KYC Status</SelectItem>
                <SelectItem value="userStatus">Account Status</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort order */}
            <Button
              variant="outline"
              className="h-10 w-10 p-0"
              onClick={() => { setSortOrder(sortOrder === "asc" ? "desc" : "asc"); setPage(1); }}
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
            >
              {sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>

            {activeFilterCount > 0 && (
              <Button variant="ghost" className="h-10 gap-1.5 text-muted-foreground hover:text-foreground" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">KYC Status</Label>
                  <Select value={kycStatus || "_all"} onValueChange={handleFilterChange(setKycStatus)}>
                    <SelectTrigger className="h-9 text-sm bg-background">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account Status</Label>
                  <Select value={userStatus || "_all"} onValueChange={handleFilterChange(setUserStatus)}>
                    <SelectTrigger className="h-9 text-sm bg-background">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nationality</Label>
                  <Select value={nationality || "_all"} onValueChange={handleFilterChange(setNationality)}>
                    <SelectTrigger className="h-9 text-sm bg-background">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All</SelectItem>
                      {(nationalitiesData || []).map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</Label>
                  <Select value={role || "_all"} onValueChange={handleFilterChange(setRole)}>
                    <SelectTrigger className="h-9 text-sm bg-background">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All</SelectItem>
                      <SelectItem value="GUEST">Guest</SelectItem>
                      <SelectItem value="PROPERTY_MANAGER">Property Manager</SelectItem>
                      <SelectItem value="PROPERTY_OWNER">Property Owner</SelectItem>
                      <SelectItem value="TENANT">Tenant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Joined From</Label>
                  <Input
                    type="date"
                    className="h-9 text-sm bg-background"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Joined To</Label>
                  <Input
                    type="date"
                    className="h-9 text-sm bg-background"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : guests.length === 0 ? (
            <div className="text-center py-20">
              <UserX className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-muted-foreground">No users found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {search || activeFilterCount > 0
                  ? "Try adjusting your search or filters"
                  : "No user accounts have been created yet"}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button className="flex items-center font-medium" onClick={() => toggleSort("fullName")}>
                          Name <SortIcon field="fullName" />
                        </button>
                      </TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium" onClick={() => toggleSort("email")}>
                          Email <SortIcon field="email" />
                        </button>
                      </TableHead>
                      <TableHead className="hidden md:table-cell">Phone</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        <button className="flex items-center font-medium" onClick={() => toggleSort("nationality")}>
                          Nationality <SortIcon field="nationality" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium" onClick={() => toggleSort("kycStatus")}>
                          KYC <SortIcon field="kycStatus" />
                        </button>
                      </TableHead>
                      <TableHead className="hidden sm:table-cell">
                        <button className="flex items-center font-medium" onClick={() => toggleSort("userStatus")}>
                          Status <SortIcon field="userStatus" />
                        </button>
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        <button className="flex items-center font-medium" onClick={() => toggleSort("createdAt")}>
                          Joined <SortIcon field="createdAt" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guests.map((guest) => (
                      <TableRow
                        key={guest.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/admin/users/${guest.userId || guest.id}`)}
                      >
                        <TableCell className="font-medium">{guest.fullName || "N/A"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{ROLE_LABELS[guest.role] || guest.role}</TableCell>
                        <TableCell className="text-muted-foreground">{guest.email}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{guest.phone}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{guest.nationality || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={kycBadgeProps(guest.kycStatus).variant} className={kycBadgeProps(guest.kycStatus).className}>
                            {kycBadgeProps(guest.kycStatus).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={statusBadgeProps(guest.userStatus).variant} className={statusBadgeProps(guest.userStatus).className}>
                            {statusBadgeProps(guest.userStatus).label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {formatDate(guest.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} users
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                      disabled={page >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
