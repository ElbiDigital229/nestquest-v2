import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db/index";
import authRoutes from "./routes/auth";
import portalRoutes from "./routes/portal";
import adminRoutes from "./routes/admin";
import uploadRoutes from "./routes/upload";
import chatRoutes from "./routes/chat";
import linkRoutes from "./routes/links";
import notificationRoutes from "./routes/notifications";
import planRoutes from "./routes/plans";
import subscriptionRoutes from "./routes/subscriptions";
import webhookRoutes from "./routes/webhooks";
import stPropertyRoutes from "./routes/st-properties";
import publicRoutes from "./routes/public";
import bookingRoutes from "./routes/bookings";
import pmSettingsRoutes from "./routes/pm-settings";
import { checkAllDocumentExpiry } from "./utils/document-expiry-cron";
import { runBillingCron } from "./utils/billing-cron";
import { expireStaleBookings } from "./utils/booking-expiry-cron";
import { requireBillingCurrent } from "./middleware/billing-guard";

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

// ── Middleware ──────────────────────────────────────────

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Session ────────────────────────────────────────────

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "nestquest-dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  })
);

// ── Health (before routes to verify server is up) ──────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "2.0", timestamp: new Date().toISOString() });
});

// ── Static file serving for uploads ────────────────────

app.use("/uploads", express.static(path.join(__dirname2, "uploads")));

// ── Billing Guard (before routes, after session) ──────

app.use(requireBillingCurrent);

// ── Routes ─────────────────────────────────────────────

app.use("/api/upload", uploadRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/links", linkRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/plans", planRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/st-properties", stPropertyRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/pm-settings", pmSettingsRoutes);

// ── Start ──────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Routes mounted: /api/auth, /api/portal, /api/admin`);

  // Run document expiry check on startup and every 24 hours
  checkAllDocumentExpiry().catch(err => console.error("[Document Expiry Cron] Error:", err));
  setInterval(() => {
    checkAllDocumentExpiry().catch(err => console.error("[Document Expiry Cron] Error:", err));
  }, 24 * 60 * 60 * 1000);

  // Run billing cron on startup and every hour
  runBillingCron().catch(err => console.error("[Billing Cron] Error:", err));
  setInterval(() => {
    runBillingCron().catch(err => console.error("[Billing Cron] Error:", err));
  }, 60 * 60 * 1000);

  // Run booking expiry check on startup and every 15 minutes
  expireStaleBookings().catch(err => console.error("[Booking Expiry Cron] Error:", err));
  setInterval(() => {
    expireStaleBookings().catch(err => console.error("[Booking Expiry Cron] Error:", err));
  }, 15 * 60 * 1000);
});

export default app;
