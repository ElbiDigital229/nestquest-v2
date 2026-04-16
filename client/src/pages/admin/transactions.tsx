import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Receipt,
  DollarSign,
  Users,
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface Transaction {
  id: string;
  amount: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
  userRole: string;
  planName: string;
  guestId: string;
  subscriptionStatus: string | null;
}

interface TransactionsResponse {
  stats: {
    totalRevenue: string;
    totalTransactions: number;
    activeSubscribers: number;
    trialSubscribers: number;
    totalSubscribers: number;
  };
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export default function AdminTransactions() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery<TransactionsResponse>({
    queryKey: ["admin-transactions", debouncedSearch, status, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status && status !== "all") params.set("status", status);
      params.set("page", String(page));
      params.set("limit", String(limit));
      return api.get(`/admin/transactions?${params.toString()}`);
    },
  });

  const stats = data?.stats;
  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function statusBadge(s: string, subStatus: string | null = null) {
    // If the invoice is pending but the subscription is in trial, show "Trial" instead
    const effective = s.toLowerCase() === "pending" && subStatus === "trial" ? "trial" : s.toLowerCase();
    const label = effective.charAt(0).toUpperCase() + effective.slice(1);
    switch (effective) {
      case "paid":
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            {label}
          </Badge>
        );
      case "trial":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
            {label}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
            {label}
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="destructive">
            {label}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Transactions</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Subscription revenue and payment history
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">
                {isLoading ? "-" : `AED ${stats?.totalRevenue ?? "0"}`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold">
                {isLoading ? "-" : (stats?.totalTransactions ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Subscribers</p>
              <p className="text-2xl font-bold">
                {isLoading ? "-" : (stats?.activeSubscribers ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">On Trial</p>
              <p className="text-2xl font-bold">
                {isLoading ? "-" : (stats?.trialSubscribers ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-4 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No transactions found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Date
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    User
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Plan
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Amount
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm">
                      {formatDate(tx.paidAt || tx.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-left hover:underline"
                        onClick={() => navigate(`/admin/users/${tx.guestId}`)}
                      >
                        <p className="text-sm font-medium">{tx.userName}</p>
                        <p className="text-xs text-muted-foreground">{tx.userEmail}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">{tx.planName}</td>
                    <td className="px-4 py-3 text-sm font-medium">AED {tx.amount}</td>
                    <td className="px-4 py-3">{statusBadge(tx.status, tx.subscriptionStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} transactions)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
