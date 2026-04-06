import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import session from "express-session";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import * as Sentry from "@sentry/node";
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
import paymentsRoutes from "./routes/payments";
import pmSettingsRoutes from "./routes/pm-settings";
import teamRoutes from "./routes/team";
import cleanerRoutes from "./routes/cleaners";
import messageTemplateRoutes from "./routes/message-templates";
import stLocksRoutes from "./routes/st-locks";
import { checkAllDocumentExpiry } from "./utils/document-expiry-cron";
import { runBillingCron } from "./utils/billing-cron";
import { expireStaleBookings } from "./utils/booking-expiry-cron";
import { runMessageTriggerCron } from "./utils/message-trigger-cron";
import "./services/booking-lifecycle"; // registers event listeners (side-effect import)
import { requireBillingCurrent } from "./middleware/billing-guard";
import { requestId } from "./middleware/request-id";
import { buildSessionStore } from "./utils/session-store";
import { setupSwagger } from "./utils/swagger";
import logger from "./utils/logger";
import { AppError, ValidationError } from "./errors/index";

const isProduction = process.env.NODE_ENV === "production";

// ── Enforce required env vars in production ────────────

if (isProduction) {
  const required = ["SESSION_SECRET", "DATABASE_URL", "ALLOWED_ORIGINS"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.fatal({ missing }, "Required environment variables are not set. Refusing to start.");
    process.exit(1);
  }
} else if (!process.env.SESSION_SECRET) {
  logger.warn("SESSION_SECRET not set — sessions will not persist across restarts (dev only)");
}

// ── Sentry (error tracking) ────────────────────────────

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    // Attach request context to every error automatically
    integrations: [],
  });
  logger.info("Sentry error tracking enabled");
}

// ── App bootstrap ──────────────────────────────────────

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

// ── Trust proxy (required for rate limiting + secure cookies behind nginx/ALB) ──
if (isProduction) {
  app.set("trust proxy", 1);
}

// ── Stripe webhooks need raw body — mount BEFORE express.json() ───────────
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

// ── Request ID (attach before logging so logs include the ID) ──────────────
app.use(requestId);

// ── Request logging ────────────────────────────────────

app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res) => (res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    // Include request ID in every log line
    customProps: (req: any) => ({ requestId: req.requestId }),
    redact: ["req.headers.authorization", "req.headers.cookie"],
  })
);

// ── Security headers (Helmet) ──────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Vite HMR requires unsafe-inline in dev
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    crossOriginEmbedderPolicy: false, // Required for Leaflet maps
  })
);

// ── CORS ───────────────────────────────────────────────

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : isProduction
  ? []
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

if (isProduction && allowedOrigins.length === 0) {
  logger.warn("ALLOWED_ORIGINS not set in production — CORS will block all cross-origin requests");
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
    exposedHeaders: ["x-request-id"],
  })
);

// ── Body parsing ───────────────────────────────────────

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Session (async store: Redis if available, PG fallback) ────────────────

const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

// Sessions are initialized async — server starts after store is ready
async function startServer(): Promise<void> {
  const store = await buildSessionStore();

  app.use(
    session({
      store,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: "nq.sid", // Don't use default 'connect.sid' — fingerprinting risk
      cookie: {
        secure: isProduction,      // HTTPS-only in production
        httpOnly: true,            // JS cannot read cookie
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: isProduction ? "strict" : "lax",
      },
    })
  );

  // ── API Docs (Swagger) ─────────────────────────────────

  if (!isProduction || process.env.ENABLE_SWAGGER === "true") {
    setupSwagger(app);
    logger.info("Swagger docs available at /api/docs");
  }

  // ── Health ─────────────────────────────────────────────

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [Health]
   *     summary: Server and database health check
   *     security: []
   *     responses:
   *       200:
   *         description: Healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, example: ok }
   *                 version: { type: string, example: "2.0" }
   *                 db: { type: string, example: connected }
   *                 sessionStore: { type: string, example: redis }
   *                 timestamp: { type: string, format: date-time }
   *       503:
   *         description: Unhealthy
   */
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({
        status: "ok",
        version: "2.0",
        db: "connected",
        sessionStore: process.env.REDIS_URL ? "redis" : "postgres",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({ status: "error", db: "disconnected" });
    }
  });

  // ── Static uploads (local disk fallback when S3 not configured) ───────────
  const uploadsPath = path.join(__dirname2, "uploads");
  app.use("/uploads", express.static(uploadsPath));

  // ── Billing Guard ──────────────────────────────────────
  app.use(requireBillingCurrent);

  // ── Routes ─────────────────────────────────────────────

  app.use("/api/payments", paymentsRoutes);
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
  app.use("/api/team", teamRoutes);
  app.use("/api/cleaners", cleanerRoutes);
  app.use("/api/message-templates", messageTemplateRoutes);
  app.use("/api/st-locks", stLocksRoutes);

  // ── Global error handler ───────────────────────────────

  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const requestId = (req as any).requestId;

    // Known application errors — don't log as errors, don't send to Sentry
    if (err instanceof AppError) {
      if (err.status >= 500) {
        logger.error({ err, url: req.url, method: req.method, requestId }, err.message);
      } else {
        logger.warn({ status: err.status, message: err.message, url: req.url }, "App error");
      }

      const body: Record<string, any> = { error: err.message, requestId };
      if (err instanceof ValidationError && err.details) {
        body.details = err.details;
      }
      return res.status(err.status).json(body);
    }

    // Unexpected errors — log fully + send to Sentry
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err, {
        extra: { url: req.url, method: req.method, requestId },
      });
    }

    logger.error({ err, url: req.url, method: req.method, requestId }, "Unhandled error");

    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: isProduction ? "An unexpected error occurred" : err.message,
      requestId,
    });
  });

  // ── Start listening ────────────────────────────────────

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(
      {
        port: PORT,
        env: process.env.NODE_ENV || "development",
        sessionStore: process.env.REDIS_URL ? "redis" : "postgres",
        s3: !!process.env.S3_BUCKET,
        sentry: !!process.env.SENTRY_DSN,
        stripe: !!process.env.STRIPE_SECRET_KEY,
      },
      "Server started"
    );

    checkAllDocumentExpiry().catch((err) => logger.error({ err }, "[Document Expiry Cron]"));
    setInterval(
      () => checkAllDocumentExpiry().catch((err) => logger.error({ err }, "[Document Expiry Cron]")),
      24 * 60 * 60 * 1000
    );

    runBillingCron().catch((err) => logger.error({ err }, "[Billing Cron]"));
    setInterval(
      () => runBillingCron().catch((err) => logger.error({ err }, "[Billing Cron]")),
      60 * 60 * 1000
    );

    expireStaleBookings().catch((err) => logger.error({ err }, "[Booking Expiry Cron]"));
    setInterval(
      () => expireStaleBookings().catch((err) => logger.error({ err }, "[Booking Expiry Cron]")),
      15 * 60 * 1000
    );

    runMessageTriggerCron().catch((err) => logger.error({ err }, "[Message Trigger Cron]"));
    setInterval(
      () => runMessageTriggerCron().catch((err) => logger.error({ err }, "[Message Trigger Cron]")),
      24 * 60 * 60 * 1000
    );
  });
}

startServer().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});

export default app;
