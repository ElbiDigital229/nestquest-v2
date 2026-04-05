import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db/index";
import { users, userAuditLog } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// All routes require a portal role (non-admin users with profiles)
router.use(requireAuth, requireRole("GUEST", "PROPERTY_MANAGER", "PROPERTY_OWNER", "TENANT"));

// ── Get Guest Profile ──────────────────────────────────

router.get("/profile", async (req: Request, res: Response) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!)).limit(1);

    if (!user || !user.fullName) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      profile: user,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Update Guest Profile ───────────────────────────────

router.patch("/profile", async (req: Request, res: Response) => {
  try {
    const {
      fullName, dob, nationality, countryOfResidence, residentAddress,
      emiratesIdNumber, emiratesIdExpiry, emiratesIdFrontUrl, emiratesIdBackUrl,
      passportNumber, passportExpiry, passportFrontUrl,
      tradeLicenseExpiry, tradeLicenseUrl,
      companyName, companyWebsite, companyDescription, companyAddress,
      phone,
    } = req.body;

    const updates: Record<string, any> = {};
    if (fullName) updates.fullName = fullName;
    if (dob) updates.dob = dob;
    if (nationality) updates.nationality = nationality;
    if (countryOfResidence) updates.countryOfResidence = countryOfResidence;
    if (residentAddress) updates.residentAddress = residentAddress;
    if (emiratesIdNumber) updates.emiratesIdNumber = emiratesIdNumber;
    if (emiratesIdExpiry) updates.emiratesIdExpiry = emiratesIdExpiry;
    if (emiratesIdFrontUrl) updates.emiratesIdFrontUrl = emiratesIdFrontUrl;
    if (emiratesIdBackUrl) updates.emiratesIdBackUrl = emiratesIdBackUrl;
    if (passportNumber) updates.passportNumber = passportNumber;
    if (passportExpiry) updates.passportExpiry = passportExpiry;
    if (passportFrontUrl) updates.passportFrontUrl = passportFrontUrl;
    if (tradeLicenseExpiry) updates.tradeLicenseExpiry = tradeLicenseExpiry;
    if (tradeLicenseUrl) updates.tradeLicenseUrl = tradeLicenseUrl;
    if (companyName) updates.companyName = companyName;
    if (companyWebsite) updates.companyWebsite = companyWebsite;
    if (companyDescription) updates.companyDescription = companyDescription;
    if (companyAddress) updates.companyAddress = companyAddress;

    if (phone) updates.phone = phone;

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db.update(users).set(updates).where(eq(users.id, req.session.userId!));
    }

    // Audit log
    await db.insert(userAuditLog).values({
      userId: req.session.userId!,
      action: "PROFILE_UPDATED",
      details: "Profile updated",
      metadata: JSON.stringify({ fields: Object.keys(updates) }),
      ipAddress: req.ip,
    });

    return res.json({ message: "Profile updated successfully" });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Change Password ────────────────────────────────────

router.post("/change-password", async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required" });
    }

    // Validate new password
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ error: "New password does not meet requirements" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId!)).limit(1);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, user.id));

    // Audit log
    await db.insert(userAuditLog).values({
      userId: user.id,
      action: "PASSWORD_CHANGED",
      details: "Password changed",
      ipAddress: req.ip,
    });

    return res.json({ message: "Password changed successfully" });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Get Activity Log ───────────────────────────────────

router.get("/activity", async (req: Request, res: Response) => {
  try {
    const logs = await db
      .select()
      .from(userAuditLog)
      .where(eq(userAuditLog.userId, req.session.userId!))
      .orderBy(userAuditLog.createdAt)
      .limit(50);

    // Reverse to get newest first (orderBy doesn't support desc easily)
    return res.json(logs.reverse());
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
