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

// Generate a 1x1 pixel PNG placeholder (valid minimal PNG)
function createPlaceholderPng(): Buffer {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPkE0U2KAAAAABJRU5ErkJggg==";
  return Buffer.from(base64, "base64");
}

function savePlaceholder(filename: string): string {
  const uploadsDir = path.join(__dirname2, "..", "server", "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, createPlaceholderPng());
  return `/uploads/${filename}`;
}

async function seed() {
  const client = await pool.connect();
  const passwordHash = await bcrypt.hash("Password1!", 10);

  // Create placeholder images
  const idFront = savePlaceholder("seed-id-front.png");
  const idBack = savePlaceholder("seed-id-back.png");
  const passportImg = savePlaceholder("seed-passport.png");
  const tradeLicenseImg = savePlaceholder("seed-trade-license.png");

  const seedUsers = [
    {
      email: "guest@nestquest.com",
      role: "GUEST",
      phone: "+971501000001",
      fullName: "Ahmed Al Rashid",
      dob: "1990-05-15",
      nationality: "UAE",
      countryOfResidence: "UAE",
      residentAddress: "123 Marina Walk, Dubai Marina, Dubai",
      emiratesIdNumber: "784-1990-1234567-1",
      emiratesIdExpiry: "2028-05-15",
      emiratesIdFrontUrl: idFront,
      emiratesIdBackUrl: idBack,
      passportNumber: "P1234567",
      passportExpiry: "2030-01-15",
      passportFrontUrl: passportImg,
      tradeLicenseExpiry: null as string | null,
      tradeLicenseUrl: null as string | null,
      companyName: null as string | null,
      companyWebsite: null as string | null,
      companyDescription: null as string | null,
      companyAddress: null as string | null,
    },
    {
      email: "sarah.pm@nestquest.com",
      role: "PROPERTY_MANAGER",
      phone: "+971502000002",
      fullName: "Sarah Al Maktoum",
      dob: "1988-03-22",
      nationality: "UAE",
      countryOfResidence: "UAE",
      residentAddress: "456 Sheikh Zayed Road, Business Bay, Dubai",
      emiratesIdNumber: "784-1988-7654321-2",
      emiratesIdExpiry: "2029-03-22",
      emiratesIdFrontUrl: idFront,
      emiratesIdBackUrl: idBack,
      passportNumber: "P7654321",
      passportExpiry: "2031-06-10",
      passportFrontUrl: passportImg,
      tradeLicenseExpiry: "2027-12-31",
      tradeLicenseUrl: tradeLicenseImg,
      companyName: "Gulf Property Management LLC",
      companyWebsite: "https://gulfpm.ae",
      companyDescription: "Premium property management services across the UAE, specializing in luxury residential and commercial properties.",
      companyAddress: "Suite 1205, Burj Khalifa Tower, Downtown Dubai",
    },
    {
      email: "owner@nestquest.com",
      role: "PROPERTY_OWNER",
      phone: "+971503000003",
      fullName: "Fatima Al Nahyan",
      dob: "1985-11-08",
      nationality: "UAE",
      countryOfResidence: "UAE",
      residentAddress: "789 Corniche Road, Al Reem Island, Abu Dhabi",
      emiratesIdNumber: "784-1985-9876543-3",
      emiratesIdExpiry: "2027-11-08",
      emiratesIdFrontUrl: idFront,
      emiratesIdBackUrl: idBack,
      passportNumber: "P9876543",
      passportExpiry: "2029-08-20",
      passportFrontUrl: passportImg,
      tradeLicenseExpiry: null as string | null,
      tradeLicenseUrl: null as string | null,
      companyName: null as string | null,
      companyWebsite: null as string | null,
      companyDescription: null as string | null,
      companyAddress: null as string | null,
    },
    {
      email: "tenant@nestquest.com",
      role: "TENANT",
      phone: "+971504000004",
      fullName: "Ravi Krishnan",
      dob: "1992-07-20",
      nationality: "India",
      countryOfResidence: "UAE",
      residentAddress: "Apt 402, Al Majaz Tower, Sharjah",
      emiratesIdNumber: "784-1992-1122334-4",
      emiratesIdExpiry: "2028-07-20",
      emiratesIdFrontUrl: idFront,
      emiratesIdBackUrl: idBack,
      passportNumber: "J5566778",
      passportExpiry: "2032-02-14",
      passportFrontUrl: passportImg,
      tradeLicenseExpiry: null as string | null,
      tradeLicenseUrl: null as string | null,
      companyName: null as string | null,
      companyWebsite: null as string | null,
      companyDescription: null as string | null,
      companyAddress: null as string | null,
    },
  ];

  try {
    await client.query("BEGIN");

    for (const u of seedUsers) {
      // Delete existing user+guest for this email+role
      const existing = await client.query(
        "SELECT id FROM users WHERE email = $1 AND role = $2",
        [u.email, u.role]
      );
      if (existing.rows.length > 0) {
        await client.query("DELETE FROM users WHERE id = $1", [existing.rows[0].id]);
      }

      const userId = crypto.randomUUID();
      const guestId = crypto.randomUUID();

      // Insert user
      await client.query(
        `INSERT INTO users (id, email, password_hash, role, phone, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())`,
        [userId, u.email, passwordHash, u.role, u.phone]
      );

      // Insert guest profile
      await client.query(
        `INSERT INTO guests (
          id, user_id, full_name, dob, nationality, country_of_residence, resident_address,
          emirates_id_number, emirates_id_expiry, emirates_id_front_url, emirates_id_back_url,
          passport_number, passport_expiry, passport_front_url,
          trade_license_expiry, trade_license_url,
          company_name, company_website, company_description, company_address,
          kyc_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'verified', NOW(), NOW()
        )`,
        [
          guestId, userId, u.fullName, u.dob, u.nationality, u.countryOfResidence, u.residentAddress,
          u.emiratesIdNumber, u.emiratesIdExpiry, u.emiratesIdFrontUrl, u.emiratesIdBackUrl,
          u.passportNumber, u.passportExpiry, u.passportFrontUrl,
          u.tradeLicenseExpiry, u.tradeLicenseUrl,
          u.companyName, u.companyWebsite,
          u.companyDescription, u.companyAddress,
        ]
      );

      // Audit log
      await client.query(
        `INSERT INTO user_audit_log (id, user_id, action, details, created_at)
         VALUES ($1, $2, 'ACCOUNT_CREATED', 'Seeded account', NOW())`,
        [crypto.randomUUID(), userId]
      );

      console.log(`✓ Seeded ${u.role}: ${u.email} (${u.fullName})`);
    }

    await client.query("COMMIT");
    console.log("\nAll users seeded. Password: Password1!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
