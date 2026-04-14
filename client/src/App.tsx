import { lazy, Suspense } from "react";
import { Route, Switch, Redirect } from "wouter";
import { useAuth } from "@/lib/auth-context";

// ── Eagerly loaded (needed immediately on any visit) ──────────────────────────
import RoleSelect from "@/pages/auth/role-select";
import GuestSignup from "@/pages/auth/guest-signup";
import GuestLogin from "@/pages/auth/guest-login";
import AdminLogin from "@/pages/auth/admin-login";
import PublicHome from "@/pages/public/home";
import PortalLayout from "@/components/layout/portal-layout";
import AdminLayout from "@/components/layout/admin-layout";

// ── Lazily loaded (split into separate JS chunks) ─────────────────────────────
// Public pages — loaded when a visitor browses listings
const PublicSearch = lazy(() => import("@/pages/public/search"));
const PublicPropertyDetail = lazy(() => import("@/pages/public/property-detail"));
const BookingConfirm = lazy(() => import("@/pages/public/booking-confirm"));
const BookingPayment = lazy(() => import("@/pages/public/booking-payment"));
const BookingSuccess = lazy(() => import("@/pages/public/booking-success"));

// Portal pages — only loaded after login
const PortalSettings = lazy(() => import("@/pages/portal/settings"));
const PortalDocuments = lazy(() => import("@/pages/portal/documents"));
const PortalReports = lazy(() => import("@/pages/portal/reports"));
const PortalSettlements = lazy(() => import("@/pages/portal/settlements"));
const PortalTeam = lazy(() => import("@/pages/portal/team"));
const CalendarOverview = lazy(() => import("@/pages/portal/calendar-overview"));
const StReviews = lazy(() => import("@/pages/portal/st-reviews"));
const MyReviews = lazy(() => import("@/pages/portal/my-reviews"));
const PoReports = lazy(() => import("@/pages/portal/po-reports"));
const CleanerOps = lazy(() => import("@/pages/portal/cleaner-ops"));
const ReviewPage = lazy(() => import("@/pages/portal/review"));
const CleanerTasks = lazy(() => import("@/pages/portal/cleaner-tasks"));
const PortalMessages = lazy(() => import("@/pages/portal/messages"));
const MyBookings = lazy(() => import("@/pages/portal/my-bookings"));
const PropertyOwnersPage = lazy(() => import("@/pages/portal/property-owners"));
const TenantsPage = lazy(() => import("@/pages/portal/tenants"));
const PropertyManagersPage = lazy(() => import("@/pages/portal/property-managers"));
const PortalNotifications = lazy(() => import("@/pages/portal/notifications"));
const PlanSelection = lazy(() => import("@/pages/portal/plan-selection"));
const Checkout = lazy(() => import("@/pages/portal/checkout"));
const StCancellations = lazy(() => import("@/pages/portal/st-cancellations"));
const StPricing = lazy(() => import("@/pages/portal/st-pricing"));
const StGuests = lazy(() => import("@/pages/portal/st-guests"));
const StProperties = lazy(() => import("@/pages/portal/st-properties"));
const StAnalytics = lazy(() => import("@/pages/portal/st-analytics"));
const StMessageTemplates = lazy(() => import("@/pages/portal/st-message-templates"));
const StSmartLocks = lazy(() => import("@/pages/portal/st-smart-locks"));
const StPropertyWizard = lazy(() => import("@/pages/portal/st-property-wizard"));
const StPropertyView = lazy(() => import("@/pages/portal/st-property-view"));
const PoProperties = lazy(() => import("@/pages/portal/po-properties"));
const PoPropertyView = lazy(() => import("@/pages/portal/po-property-view"));
const PoReviews = lazy(() => import("@/pages/portal/po-reviews"));

// Admin pages — only loaded for super admins
const AdminGuestsList = lazy(() => import("@/pages/admin/guests-list"));
const AdminGuestDetail = lazy(() => import("@/pages/admin/guest-detail"));
const AdminChat = lazy(() => import("@/pages/admin/chat"));
const AdminNotifications = lazy(() => import("@/pages/admin/notifications"));
const AdminCompliance = lazy(() => import("@/pages/admin/compliance"));
const AdminPlans = lazy(() => import("@/pages/admin/plans"));
const AdminTransactions = lazy(() => import("@/pages/admin/transactions"));
const AdminStPropertyView = lazy(() => import("@/pages/admin/st-property-view"));
const AdminSiteSettings = lazy(() => import("@/pages/admin/site-settings"));

// ── Constants ─────────────────────────────────────────────────────────────────

const PORTAL_ROLES = ["GUEST", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT", "PM_TEAM_MEMBER", "CLEANER"];

// ── Loading fallback ──────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

// ── Auth guard ────────────────────────────────────────────────────────────────

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!user || !roles.includes(user.role)) {
    const loginPath = roles.includes("SUPER_ADMIN") ? "/admin/login" : "/";
    return <Redirect to={loginPath} />;
  }
  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Auth */}
        <Route path="/login" component={RoleSelect} />
        <Route path="/login/:roleSlug">
          {(params) => <GuestLogin roleSlug={params.roleSlug} />}
        </Route>
        <Route path="/signup/:roleSlug">
          {(params) => <GuestSignup roleSlug={params.roleSlug} />}
        </Route>
        <Route path="/admin/login" component={AdminLogin} />

        {/* Backwards-compatible redirects */}
        <Route path="/guest/login"><Redirect to="/login/guest" /></Route>
        <Route path="/guest/signup"><Redirect to="/signup/guest" /></Route>
        <Route path="/guest/:rest*">
          {(params) => <Redirect to={`/portal/${params.rest}`} />}
        </Route>

        {/* ── Portal ───────────────────────────────────────────── */}
        <Route path="/portal/settings">
          <ProtectedRoute roles={PORTAL_ROLES}>
            <PortalLayout><PortalSettings /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/messages">
          <ProtectedRoute roles={PORTAL_ROLES}>
            <PortalLayout fullWidth><PortalMessages /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/my-bookings/:id">
          {(params) => <Redirect to={`/portal/my-bookings?id=${params.id}`} />}
        </Route>
        <Route path="/portal/my-bookings">
          <ProtectedRoute roles={PORTAL_ROLES}>
            <PortalLayout><MyBookings /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/property-owners">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><PropertyOwnersPage /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/tenants">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><TenantsPage /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/property-managers">
          <ProtectedRoute roles={["PROPERTY_OWNER", "TENANT"]}>
            <PortalLayout><PropertyManagersPage /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/plans">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><PlanSelection /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/checkout">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><Checkout /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/st-properties/:id/edit">
          {(params) => (
            <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
              <PortalLayout fullWidth><StPropertyWizard id={params.id} /></PortalLayout>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/portal/st-properties/:id">
          {(params) => (
            <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
              <PortalLayout fullWidth><StPropertyView id={params.id} /></PortalLayout>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/portal/st-analytics">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><StAnalytics /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/st-message-templates">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><StMessageTemplates /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/st-smart-locks">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><StSmartLocks /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/st-cancellations">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><StCancellations /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/st-guests">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><StGuests /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/st-pricing">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout fullWidth><StPricing /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/st-properties">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><StProperties /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/documents">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PROPERTY_OWNER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><PortalDocuments /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/reports">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><PortalReports /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/settlements">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PROPERTY_OWNER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><PortalSettlements /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/team">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><PortalTeam /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/review/:bookingId">
          {(params) => (
            <ProtectedRoute roles={["GUEST", "PROPERTY_OWNER", "TENANT"]}>
              <PortalLayout><ReviewPage bookingId={params.bookingId} /></PortalLayout>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/portal/po-reports">
          <ProtectedRoute roles={["PROPERTY_OWNER"]}>
            <PortalLayout><PoReports /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/my-reviews">
          <ProtectedRoute roles={["PROPERTY_OWNER", "PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><MyReviews /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/st-reviews">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><StReviews /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/calendar">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout fullWidth><CalendarOverview /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/cleaner-ops">
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout><CleanerOps /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/cleaner-tasks">
          <ProtectedRoute roles={["CLEANER"]}>
            <PortalLayout><CleanerTasks /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/po-properties/:id">
          {(params) => (
            <ProtectedRoute roles={["PROPERTY_OWNER"]}>
              <PortalLayout fullWidth><PoPropertyView id={params.id} /></PortalLayout>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/portal/po-properties">
          <ProtectedRoute roles={["PROPERTY_OWNER"]}>
            <PortalLayout><PoProperties /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/po-reviews">
          <ProtectedRoute roles={["PROPERTY_OWNER"]}>
            <PortalLayout><PoReviews /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal/notifications">
          <ProtectedRoute roles={PORTAL_ROLES}>
            <PortalLayout><PortalNotifications /></PortalLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/portal">
          <ProtectedRoute roles={PORTAL_ROLES}>
            <PortalLayout><PortalSettings /></PortalLayout>
          </ProtectedRoute>
        </Route>

        {/* ── Admin ────────────────────────────────────────────── */}
        <Route path="/admin/st-properties/:id">
          {(params) => (
            <ProtectedRoute roles={["SUPER_ADMIN"]}>
              <AdminLayout fullWidth><AdminStPropertyView id={params.id} /></AdminLayout>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/users/:id">
          {(params) => (
            <ProtectedRoute roles={["SUPER_ADMIN"]}>
              <AdminLayout><AdminGuestDetail id={params.id} /></AdminLayout>
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/users">
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout><AdminGuestsList /></AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/messages/chat">
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout fullWidth><AdminChat /></AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/plans">
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout><AdminPlans /></AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/transactions">
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout><AdminTransactions /></AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/compliance">
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout><AdminCompliance /></AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/notifications">
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout><AdminNotifications /></AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin/site-settings">
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout><AdminSiteSettings /></AdminLayout>
          </ProtectedRoute>
        </Route>
        <Route path="/admin">
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout><AdminGuestsList /></AdminLayout>
          </ProtectedRoute>
        </Route>

        {/* ── Public website ───────────────────────────────────── */}
        <Route path="/search" component={PublicSearch} />
        <Route path="/property/:id">
          {(params) => <PublicPropertyDetail id={params.id} />}
        </Route>
        <Route path="/booking/confirm" component={BookingConfirm} />
        <Route path="/booking/payment" component={BookingPayment} />
        <Route path="/booking/success" component={BookingSuccess} />

        {/* Landing */}
        <Route path="/" component={PublicHome} />
      </Switch>
    </Suspense>
  );
}
