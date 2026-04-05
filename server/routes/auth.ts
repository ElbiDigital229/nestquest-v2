import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db/index";
import { users, otpVerifications, userAuditLog, signupSchema, loginSchema, PORTAL_ROLES, userDocuments, documentTypes, notifications } from "../../shared/schema";
import { eq, and, gt, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { createNotification } from "../utils/notify";
import rateLimit from "express-rate-limit";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 5 : 100,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: "Too many signup attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Too many OTP requests. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
const SALT_ROUNDS = 10;

// ── Document Expiry Check (fire-and-forget on login) ───

async function checkDocumentExpiry(userId: string): Promise<void> {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Get user documents expiring within 30 days or already expired
  const docs = await db
    .select({
      docId: userDocuments.id,
      expiryDate: userDocuments.expiryDate,
      label: documentTypes.label,
    })
    .from(userDocuments)
    .innerJoin(documentTypes, eq(userDocuments.documentTypeId, documentTypes.id))
    .where(
      and(
        eq(userDocuments.userId, userId),
        lte(userDocuments.expiryDate, thirtyDaysFromNow)
      )
    );

  const now = new Date();

  for (const doc of docs) {
    if (!doc.expiryDate) continue;

    // Check if a notification was already sent for this document in the last 24 hours
    const [existing] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.relatedId, doc.docId),
          gt(notifications.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
        )
      )
      .limit(1);

    if (existing) continue;

    const isExpired = doc.expiryDate <= now;
    const dateStr = doc.expiryDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    await createNotification({
      userId,
      type: "KYC_SUBMISSION",
      title: isExpired ? "Document Expired" : "Document Expiring Soon",
      body: isExpired
        ? `${doc.label} has expired`
        : `${doc.label} expires on ${dateStr}`,
      relatedId: doc.docId,
    });
  }
}

// ── Send Signup OTP ────────────────────────────────────

router.post("/send-signup-otp", otpLimiter, async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Generate mock OTP
    const code = "123456";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(otpVerifications).values({
      phone,
      code,
      expiresAt,
    });

    return res.json({
      message: "OTP sent successfully",
      mock: true,
      hint: "Use code: 123456",
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Verify Signup OTP ──────────────────────────────────

router.post("/verify-signup-otp", otpLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: "Phone and OTP are required" });
    }

    // Find the latest unverified OTP for this phone
    const [record] = await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.phone, phone),
          eq(otpVerifications.code, otp),
          gt(otpVerifications.expiresAt, new Date())
        )
      )
      .orderBy(otpVerifications.createdAt)
      .limit(1);

    if (!record) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Mark as verified
    await db
      .update(otpVerifications)
      .set({ verifiedAt: new Date() })
      .where(eq(otpVerifications.id, record.id));

    return res.json({ verified: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Guest Signup ───────────────────────────────────────

router.post("/signup", signupLimiter, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;

    // Validate DOB (must be 18+)
    const dob = new Date(data.dob);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const isUnderage = age < 18 || (age === 18 && (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())));
    if (isUnderage) {
      return res.status(400).json({ error: "You must be at least 18 years old to register" });
    }

    // Validate ID expiry (must be future)
    const expiry = new Date(data.emiratesIdExpiry);
    if (expiry <= today) {
      return res.status(400).json({ error: "ID document has expired — please provide a valid, non-expired document" });
    }

    // Check duplicate email+role
    const [existing] = await db.select().from(users).where(and(eq(users.email, data.email), eq(users.role, data.role))).limit(1);
    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists for this role" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user with profile fields merged in
    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash,
        role: data.role,
        phone: data.phone,
        fullName: data.fullName,
        dob: data.dob,
        nationality: data.nationality,
        countryOfResidence: data.countryOfResidence,
        residentAddress: data.residentAddress,
        emiratesIdNumber: data.emiratesIdNumber,
        emiratesIdExpiry: data.emiratesIdExpiry,
        emiratesIdFrontUrl: data.emiratesIdFrontUrl,
        emiratesIdBackUrl: data.emiratesIdBackUrl,
        passportNumber: data.passportNumber || null,
        passportExpiry: data.passportExpiry || null,
        passportFrontUrl: data.passportFrontUrl || null,
        tradeLicenseExpiry: data.tradeLicenseExpiry || null,
        tradeLicenseUrl: data.tradeLicenseUrl || null,
        companyName: data.companyName || null,
        companyWebsite: data.companyWebsite || null,
        companyDescription: data.companyDescription || null,
        companyAddress: data.companyAddress || null,
        kycStatus: "pending",
      })
      .returning();

    // Audit log
    await db.insert(userAuditLog).values({
      userId: user.id,
      action: "ACCOUNT_CREATED",
      details: "Account created",
      metadata: JSON.stringify({ role: data.role, email: data.email }),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    // Notify super admins of new signup
    try {
      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN"));
      const roleLabel = data.role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: "USER_SIGNUP",
          title: `New user signup: ${data.fullName}`,
          body: `${data.fullName} registered as ${roleLabel}`,
          linkUrl: `/admin/users/guests`,
          relatedId: user.id,
        });
      }
    } catch {}

    // Destroy any existing session before creating new one
    await new Promise<void>((resolve) => {
      req.session.regenerate((err) => {
        if (err) console.error("Session regenerate error:", err);
        resolve();
      });
    });

    // Create fresh session
    req.session.userId = user.id;
    req.session.userRole = data.role;
    req.session.userEmail = user.email;

    return res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

// ── Login ──────────────────────────────────────────────

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password, role } = parsed.data;

    // Find user by email + role. If PM login fails, auto-try PM_TEAM_MEMBER
    let [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.role, role))).limit(1);
    if (!user && role === "PROPERTY_MANAGER") {
      // Try PM_TEAM_MEMBER, then CLEANER
      [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.role, "PM_TEAM_MEMBER"))).limit(1);
      if (!user) {
        [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.role, "CLEANER"))).limit(1);
      }
    }
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check status
    if (user.status === "suspended") {
      return res.status(403).json({ error: "Account is suspended" });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check team membership for PM_TEAM_MEMBER
    if (user.role === "PM_TEAM_MEMBER") {
      const [membership] = await db.execute(
        sql`SELECT id, status, pm_user_id FROM pm_team_members WHERE user_id = ${user.id} AND status = 'active' LIMIT 1`
      ).then(r => r.rows as any[]);
      if (!membership) {
        return res.status(403).json({ error: "Your team access has been revoked. Contact your Property Manager." });
      }
      // Also verify the parent PM account is still active
      const [parentPm] = await db.execute(
        sql`SELECT status FROM users WHERE id = ${membership.pm_user_id} LIMIT 1`
      ).then(r => r.rows as any[]);
      if (parentPm?.status === "suspended") {
        return res.status(403).json({ error: "Your Property Manager account has been suspended. Access is unavailable." });
      }
    }

    // Regenerate session to prevent session fixation
    await new Promise<void>((resolve) => {
      req.session.regenerate((err) => {
        if (err) console.error("Session regenerate error:", err);
        resolve();
      });
    });

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;

    // Audit log
    await db.insert(userAuditLog).values({
      userId: user.id,
      action: "LOGIN",
      details: `Login via email`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    // Get profile name
    let name = user.email;
    if (user.role === "PM_TEAM_MEMBER") {
      const tmResult = await db.execute(sql`SELECT full_name FROM pm_team_members WHERE user_id = ${user.id} AND status = 'active' LIMIT 1`);
      if (tmResult.rows[0]) name = (tmResult.rows[0] as any).full_name || name;
    } else if (user.role === "CLEANER") {
      // Cleaner name from audit log metadata
      const auditResult = await db.execute(sql`SELECT metadata FROM user_audit_log WHERE details LIKE '%' || ${user.email} || '%' AND action = 'SETTINGS_UPDATED' LIMIT 1`);
      if (auditResult.rows[0]) { try { name = JSON.parse((auditResult.rows[0] as any).metadata).fullName || name; } catch {} }
    } else if ((PORTAL_ROLES as readonly string[]).includes(user.role)) {
      if (user.fullName) name = user.fullName;
    }

    // Fire-and-forget: check for expiring documents
    checkDocumentExpiry(user.id).catch(() => {});

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ── Phone Login — Send OTP ─────────────────────────────

router.post("/send-login-otp", otpLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, role } = req.body;
    if (!phone || !role) {
      return res.status(400).json({ error: "Phone number and role are required" });
    }

    // Check if phone+role exists
    const [user] = await db.select().from(users).where(and(eq(users.phone, phone), eq(users.role, role))).limit(1);
    if (!user) {
      return res.status(404).json({ error: "No account found with this phone number" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "Account is suspended" });
    }

    // Generate mock OTP
    const code = "123456";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(otpVerifications).values({
      phone,
      code,
      expiresAt,
    });

    return res.json({
      message: "OTP sent successfully",
      mock: true,
      hint: "Use code: 123456",
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Phone Login — Verify OTP & Login ──────────────────

router.post("/verify-login-otp", otpLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, otp, role } = req.body;
    if (!phone || !otp || !role) {
      return res.status(400).json({ error: "Phone, OTP, and role are required" });
    }

    // Verify OTP
    const [record] = await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.phone, phone),
          eq(otpVerifications.code, otp),
          gt(otpVerifications.expiresAt, new Date())
        )
      )
      .orderBy(otpVerifications.createdAt)
      .limit(1);

    if (!record) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Mark OTP as verified
    await db
      .update(otpVerifications)
      .set({ verifiedAt: new Date() })
      .where(eq(otpVerifications.id, record.id));

    // Find user by phone + role
    const [user] = await db.select().from(users).where(and(eq(users.phone, phone), eq(users.role, role))).limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "Account is suspended" });
    }

    // Regenerate session to prevent session fixation
    await new Promise<void>((resolve) => {
      req.session.regenerate((err) => {
        if (err) console.error("Session regenerate error:", err);
        resolve();
      });
    });

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;

    // Audit log
    await db.insert(userAuditLog).values({
      userId: user.id,
      action: "LOGIN",
      details: "Login via phone OTP",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || null,
    });

    // Get profile name
    let name = user.email;
    if (user.role === "PM_TEAM_MEMBER") {
      const tmResult = await db.execute(sql`SELECT full_name FROM pm_team_members WHERE user_id = ${user.id} AND status = 'active' LIMIT 1`);
      if (tmResult.rows[0]) name = (tmResult.rows[0] as any).full_name || name;
    } else if (user.role === "CLEANER") {
      // Cleaner name from audit log metadata
      const auditResult = await db.execute(sql`SELECT metadata FROM user_audit_log WHERE details LIKE '%' || ${user.email} || '%' AND action = 'SETTINGS_UPDATED' LIMIT 1`);
      if (auditResult.rows[0]) { try { name = JSON.parse((auditResult.rows[0] as any).metadata).fullName || name; } catch {} }
    } else if ((PORTAL_ROLES as readonly string[]).includes(user.role)) {
      if (user.fullName) name = user.fullName;
    }

    // Fire-and-forget: check for expiring documents
    checkDocumentExpiry(user.id).catch(() => {});

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name,
      },
    });
  } catch (error: any) {
    console.error("Phone login error:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// ── Get Current User ───────────────────────────────────

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!)).limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let profile = null;
    if (user.role === "PM_TEAM_MEMBER") {
      // Team members: get profile from pm_team_members, not guests
      const tmResult = await db.execute(sql`
        SELECT tm.full_name, tm.role_id, tm.status AS team_status,
          r.name AS role_name, r.permissions
        FROM pm_team_members tm
        LEFT JOIN pm_roles r ON r.id = tm.role_id
        WHERE tm.user_id = ${user.id} AND tm.status = 'active'
        LIMIT 1
      `);
      const tm = tmResult.rows[0] as any;
      profile = tm ? {
        fullName: tm.full_name,
        roleName: tm.role_name,
        permissions: tm.permissions ? JSON.parse(tm.permissions) : [],
        teamStatus: tm.team_status,
      } : null;
    } else if ((PORTAL_ROLES as readonly string[]).includes(user.role)) {
      profile = user;
      // Fire-and-forget: check for expiring documents (not for team members)
      checkDocumentExpiry(user.id).catch(() => {});
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt,
      },
      profile,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Logout ─────────────────────────────────────────────

router.post("/logout", (req: Request, res: Response) => {
  if (req.session?.userId) {
    // Fire-and-forget audit log
    db.insert(userAuditLog).values({
      userId: req.session.userId,
      action: "LOGOUT",
      details: "User logged out",
      ipAddress: req.ip,
    }).catch(() => {});
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.clearCookie("connect.sid");
    return res.json({ message: "Logged out successfully" });
  });
});

export default router;
