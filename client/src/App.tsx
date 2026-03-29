import { Route, Switch, Redirect } from "wouter";
import { useAuth } from "@/lib/auth-context";
import RoleSelect from "@/pages/auth/role-select";
import GuestSignup from "@/pages/auth/guest-signup";
import GuestLogin from "@/pages/auth/guest-login";
import AdminLogin from "@/pages/auth/admin-login";
import PortalSettings from "@/pages/portal/settings";
import PortalDocuments from "@/pages/portal/documents";
import PortalReports from "@/pages/portal/reports";
import PortalSettlements from "@/pages/portal/settlements";
import PortalTeam from "@/pages/portal/team";
import CleanerOps from "@/pages/portal/cleaner-ops";
import CleanerTasks from "@/pages/portal/cleaner-tasks";
import PortalMessages from "@/pages/portal/messages";
import MyBookings from "@/pages/portal/my-bookings";
import AdminGuestsList from "@/pages/admin/guests-list";
import AdminGuestDetail from "@/pages/admin/guest-detail";
import AdminChat from "@/pages/admin/chat";
import PropertyOwnersPage from "@/pages/portal/property-owners";
import TenantsPage from "@/pages/portal/tenants";
import PropertyManagersPage from "@/pages/portal/property-managers";
import PortalNotifications from "@/pages/portal/notifications";
import AdminNotifications from "@/pages/admin/notifications";
import AdminCompliance from "@/pages/admin/compliance";
import AdminPlans from "@/pages/admin/plans";
import AdminTransactions from "@/pages/admin/transactions";
import PlanSelection from "@/pages/portal/plan-selection";
import Checkout from "@/pages/portal/checkout";
import StProperties from "@/pages/portal/st-properties";
import StPropertyWizard from "@/pages/portal/st-property-wizard";
import StPropertyView from "@/pages/portal/st-property-view";
import AdminStPropertyView from "@/pages/admin/st-property-view";
import PoProperties from "@/pages/portal/po-properties";
import PoPropertyView from "@/pages/portal/po-property-view";
import PortalLayout from "@/components/layout/portal-layout";
import AdminLayout from "@/components/layout/admin-layout";
import PublicHome from "@/pages/public/home";
import PublicSearch from "@/pages/public/search";
import PublicPropertyDetail from "@/pages/public/property-detail";
import BookingConfirm from "@/pages/public/booking-confirm";
import BookingPayment from "@/pages/public/booking-payment";
import BookingSuccess from "@/pages/public/booking-success";

const PORTAL_ROLES = ["GUEST", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT", "PM_TEAM_MEMBER", "CLEANER"];

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user || !roles.includes(user.role)) {
    const loginPath = roles.includes("SUPER_ADMIN") ? "/admin/login" : "/";
    return <Redirect to={loginPath} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Switch>
      {/* Auth routes */}
      <Route path="/login" component={RoleSelect} />
      <Route path="/login/:roleSlug">
        {(params) => <GuestLogin roleSlug={params.roleSlug} />}
      </Route>
      <Route path="/signup/:roleSlug">
        {(params) => <GuestSignup roleSlug={params.roleSlug} />}
      </Route>
      <Route path="/admin/login" component={AdminLogin} />

      {/* Backwards-compatible redirects (old /guest/* → new /portal/*) */}
      <Route path="/guest/login">
        <Redirect to="/login/guest" />
      </Route>
      <Route path="/guest/signup">
        <Redirect to="/signup/guest" />
      </Route>
      <Route path="/guest/:rest*">
        {(params) => <Redirect to={`/portal/${params.rest}`} />}
      </Route>

      {/* Portal routes (all non-admin roles) */}
      <Route path="/portal/settings">
        <ProtectedRoute roles={PORTAL_ROLES}>
          <PortalLayout>
            <PortalSettings />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/messages">
        <ProtectedRoute roles={PORTAL_ROLES}>
          <PortalLayout fullWidth>
            <PortalMessages />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/my-bookings">
        <ProtectedRoute roles={PORTAL_ROLES}>
          <PortalLayout>
            <MyBookings />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/property-owners">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <PropertyOwnersPage />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/tenants">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <TenantsPage />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/property-managers">
        <ProtectedRoute roles={["PROPERTY_OWNER", "TENANT"]}>
          <PortalLayout>
            <PropertyManagersPage />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/plans">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <PlanSelection />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/checkout">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <Checkout />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/st-properties/:id/edit">
        {(params) => (
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout fullWidth>
              <StPropertyWizard id={params.id} />
            </PortalLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/portal/st-properties/:id">
        {(params) => (
          <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
            <PortalLayout fullWidth>
              <StPropertyView id={params.id} />
            </PortalLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/portal/st-properties">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <StProperties />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/documents">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PROPERTY_OWNER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <PortalDocuments />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/reports">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <PortalReports />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/settlements">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PROPERTY_OWNER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <PortalSettlements />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/team">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <PortalTeam />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/cleaner-ops">
        <ProtectedRoute roles={["PROPERTY_MANAGER", "PM_TEAM_MEMBER"]}>
          <PortalLayout>
            <CleanerOps />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/cleaner-tasks">
        <ProtectedRoute roles={["CLEANER"]}>
          <PortalLayout>
            <CleanerTasks />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/po-properties/:id">
        {(params) => (
          <ProtectedRoute roles={["PROPERTY_OWNER"]}>
            <PortalLayout fullWidth>
              <PoPropertyView id={params.id} />
            </PortalLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/portal/po-properties">
        <ProtectedRoute roles={["PROPERTY_OWNER"]}>
          <PortalLayout>
            <PoProperties />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal/notifications">
        <ProtectedRoute roles={PORTAL_ROLES}>
          <PortalLayout>
            <PortalNotifications />
          </PortalLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/portal">
        <ProtectedRoute roles={PORTAL_ROLES}>
          <PortalLayout>
            <PortalSettings />
          </PortalLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin routes */}
      <Route path="/admin/st-properties/:id">
        {(params) => (
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout fullWidth>
              <AdminStPropertyView id={params.id} />
            </AdminLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/users/:id">
        {(params) => (
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminLayout>
              <AdminGuestDetail id={params.id} />
            </AdminLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute roles={["SUPER_ADMIN"]}>
          <AdminLayout>
            <AdminGuestsList />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/messages/chat">
        <ProtectedRoute roles={["SUPER_ADMIN"]}>
          <AdminLayout fullWidth>
            <AdminChat />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/plans">
        <ProtectedRoute roles={["SUPER_ADMIN"]}>
          <AdminLayout>
            <AdminPlans />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/transactions">
        <ProtectedRoute roles={["SUPER_ADMIN"]}>
          <AdminLayout>
            <AdminTransactions />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/compliance">
        <ProtectedRoute roles={["SUPER_ADMIN"]}>
          <AdminLayout>
            <AdminCompliance />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/notifications">
        <ProtectedRoute roles={["SUPER_ADMIN"]}>
          <AdminLayout>
            <AdminNotifications />
          </AdminLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute roles={["SUPER_ADMIN"]}>
          <AdminLayout>
            <AdminGuestsList />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      {/* Public website routes */}
      <Route path="/search" component={PublicSearch} />
      <Route path="/property/:id">
        {(params) => <PublicPropertyDetail />}
      </Route>
      <Route path="/booking/confirm" component={BookingConfirm} />
      <Route path="/booking/payment" component={BookingPayment} />
      <Route path="/booking/success" component={BookingSuccess} />

      {/* Landing — public homepage */}
      <Route path="/" component={PublicHome} />
    </Switch>
  );
}
