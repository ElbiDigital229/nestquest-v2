import pg from "pg";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/nestquest_v2",
});

function savePlaceholder(filename: string): string {
  const uploadsDir = path.join(__dirname2, "..", "server", "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, filename);
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPkE0U2KAAAAABJRU5ErkJggg==";
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  return `/uploads/${filename}`;
}

async function seed() {
  const client = await pool.connect();
  const hash = await bcrypt.hash("Test1234!", 10);

  const idFront      = savePlaceholder("seed-id-front.png");
  const idBack       = savePlaceholder("seed-id-back.png");
  const passportImg  = savePlaceholder("seed-passport.png");
  const tradeLicense = savePlaceholder("seed-trade-license.png");

  // Matches the quick-login buttons exactly
  const users = [
    {
      email: "admin@nestquest.com",
      role: "SUPER_ADMIN",
      phone: "+971500000000",
      // No profile fields — SA has no KYC profile
    },
    {
      email: "pm@nestquest.com",
      role: "PROPERTY_MANAGER",
      phone: "+971501234567",
      fullName: "Ahmed Al Maktoum",
      dob: "1985-06-15",
      nationality: "UAE",
      countryOfResidence: "UAE",
      residentAddress: "Suite 1205, Burj Khalifa Tower, Downtown Dubai",
      emiratesIdNumber: "784-1985-1234567-1",
      emiratesIdExpiry: "2029-06-15",
      emiratesIdFrontUrl: idFront,
      emiratesIdBackUrl: idBack,
      passportNumber: "P1234567",
      passportExpiry: "2031-06-15",
      passportFrontUrl: passportImg,
      tradeLicenseExpiry: "2027-12-31",
      tradeLicenseUrl: tradeLicense,
      companyName: "Gulf Property Management LLC",
      companyWebsite: "https://gulfpm.ae",
      companyDescription: "Premium property management services across the UAE.",
      companyAddress: "Suite 1205, Burj Khalifa Tower, Downtown Dubai",
    },
    {
      email: "owner@nestquest.com",
      role: "PROPERTY_OWNER",
      phone: "+971502345678",
      fullName: "Fatima Al Nahyan",
      dob: "1982-11-08",
      nationality: "UAE",
      countryOfResidence: "UAE",
      residentAddress: "789 Corniche Road, Al Reem Island, Abu Dhabi",
      emiratesIdNumber: "784-1982-9876543-2",
      emiratesIdExpiry: "2028-11-08",
      emiratesIdFrontUrl: idFront,
      emiratesIdBackUrl: idBack,
      passportNumber: "P9876543",
      passportExpiry: "2030-08-20",
      passportFrontUrl: passportImg,
      tradeLicenseExpiry: null,
      tradeLicenseUrl: null,
      companyName: null,
      companyWebsite: null,
      companyDescription: null,
      companyAddress: null,
    },
    {
      email: "guest@nestquest.com",
      role: "GUEST",
      phone: "+971503456789",
      fullName: "James Wilson",
      dob: "1990-03-22",
      nationality: "United Kingdom",
      countryOfResidence: "UAE",
      residentAddress: "Apt 204, Marina Residences, Dubai Marina",
      emiratesIdNumber: "784-1990-5556667-3",
      emiratesIdExpiry: "2028-03-22",
      emiratesIdFrontUrl: idFront,
      emiratesIdBackUrl: idBack,
      passportNumber: "GBR123456",
      passportExpiry: "2032-01-10",
      passportFrontUrl: passportImg,
      tradeLicenseExpiry: null,
      tradeLicenseUrl: null,
      companyName: null,
      companyWebsite: null,
      companyDescription: null,
      companyAddress: null,
    },
    {
      email: "maria@guest.com",
      role: "GUEST",
      phone: "+971504567890",
      fullName: "Maria Santos",
      dob: "1993-07-14",
      nationality: "Philippines",
      countryOfResidence: "UAE",
      residentAddress: "Room 12, Discovery Gardens, Dubai",
      emiratesIdNumber: "784-1993-7778889-4",
      emiratesIdExpiry: "2027-07-14",
      emiratesIdFrontUrl: idFront,
      emiratesIdBackUrl: idBack,
      passportNumber: "PHL654321",
      passportExpiry: "2029-09-05",
      passportFrontUrl: passportImg,
      tradeLicenseExpiry: null,
      tradeLicenseUrl: null,
      companyName: null,
      companyWebsite: null,
      companyDescription: null,
      companyAddress: null,
    },
    {
      email: "cleaner@nestquest.com",
      role: "CLEANER",
      phone: "+971505678901",
      // No profile fields — cleaners don't have KYC profiles
    },
  ];

  try {
    await client.query("BEGIN");

    for (const u of users) {
      const userId = crypto.randomUUID();
      const hasProfile = "fullName" in u;

      await client.query(
        `INSERT INTO users (
           id, email, password_hash, role, phone, status, created_at, updated_at
           ${hasProfile ? `,
           full_name, dob, nationality, country_of_residence, resident_address,
           emirates_id_number, emirates_id_expiry, emirates_id_front_url, emirates_id_back_url,
           passport_number, passport_expiry, passport_front_url,
           trade_license_expiry, trade_license_url,
           company_name, company_website, company_description, company_address,
           kyc_status` : ""}
         ) VALUES (
           $1, $2, $3, $4, $5, 'active', NOW(), NOW()
           ${hasProfile ? `,
           $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, 'verified'` : ""}
         )`,
        hasProfile
          ? [
              userId, u.email, hash, u.role, u.phone,
              (u as any).fullName, (u as any).dob, (u as any).nationality, (u as any).countryOfResidence, (u as any).residentAddress,
              (u as any).emiratesIdNumber, (u as any).emiratesIdExpiry, (u as any).emiratesIdFrontUrl, (u as any).emiratesIdBackUrl,
              (u as any).passportNumber, (u as any).passportExpiry, (u as any).passportFrontUrl,
              (u as any).tradeLicenseExpiry, (u as any).tradeLicenseUrl,
              (u as any).companyName, (u as any).companyWebsite, (u as any).companyDescription, (u as any).companyAddress,
            ]
          : [userId, u.email, hash, u.role, u.phone]
      );

      await client.query(
        `INSERT INTO user_audit_log (id, user_id, action, details, created_at)
         VALUES ($1, $2, 'ACCOUNT_CREATED', 'Seeded account', NOW())`,
        [crypto.randomUUID(), userId]
      );

      console.log(`✓ ${u.role.padEnd(20)} ${u.email}${hasProfile ? ` (${(u as any).fullName})` : ""}`);
    }

    await client.query("COMMIT");
    console.log("\nAll quick-login users seeded. Password: Test1234!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
