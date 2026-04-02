import supertest from "supertest";
import app from "../index.js";

export { app };

/**
 * Generate a unique email for test isolation.
 */
export function uniqueEmail(prefix = "test"): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}@testmail.com`;
}

/**
 * Generate a unique phone number for test isolation.
 */
export function uniquePhone(): string {
  return `+97150${Date.now().toString().slice(-7)}`;
}

/**
 * Valid signup payload factory. All fields satisfy the signupSchema.
 */
export function makeSignupPayload(overrides: Record<string, unknown> = {}) {
  const email = uniqueEmail("signup");
  const phone = uniquePhone();
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 2);
  const expiryStr = futureDate.toISOString().slice(0, 10);

  return {
    email,
    password: "Test@1234",
    fullName: "Test User",
    phone,
    dob: "1990-01-15",
    nationality: "AE",
    countryOfResidence: "AE",
    residentAddress: "123 Test Street, Dubai",
    emiratesIdNumber: "784-1990-1234567-1",
    emiratesIdExpiry: expiryStr,
    emiratesIdFrontUrl: "/uploads/test-front.jpg",
    emiratesIdBackUrl: "/uploads/test-back.jpg",
    role: "GUEST",
    ...overrides,
  };
}

/**
 * Helper: send the OTP verification flow then signup, returning a supertest agent
 * with an active session cookie.
 *
 * NOTE: Each call consumes 1 signup rate-limit slot (3 per hour per IP).
 * Keep total calls per test file under that limit.
 */
export async function createLoggedInAgent(
  roleOverride?: string
): Promise<{ agent: supertest.Agent; email: string; password: string; userId: string }> {
  const agent = supertest.agent(app);
  const payload = makeSignupPayload(roleOverride ? { role: roleOverride } : {});

  // Step 1: send OTP
  await agent.post("/api/auth/send-signup-otp").send({ phone: payload.phone });

  // Step 2: verify OTP (hardcoded 123456 in dev mode)
  await agent.post("/api/auth/verify-signup-otp").send({ phone: payload.phone, otp: "123456" });

  // Step 3: signup (session cookie is stored on the agent)
  const res = await agent.post("/api/auth/signup").send(payload);
  const userId = res.body?.user?.id ?? "";

  return { agent, email: payload.email, password: payload.password, userId };
}

/**
 * Helper: login with existing credentials, returning an agent with session.
 */
export async function loginAgent(
  email: string,
  password: string,
  role: string
): Promise<supertest.Agent> {
  const agent = supertest.agent(app);
  await agent.post("/api/auth/login").send({ email, password, role });
  return agent;
}
