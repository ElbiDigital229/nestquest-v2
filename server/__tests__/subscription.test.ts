import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";
import { app, createLoggedInAgent } from "./setup.js";

/**
 * Subscription endpoint tests.
 *
 * Rate limit budget: 3 signup calls. We create 2 agents (PM + Guest) and
 * reuse them across all tests.
 */

let pmAgent: supertest.Agent;
let guestAgent: supertest.Agent;
let firstPlanId: string | null = null;

beforeAll(async () => {
  // Signup #1: PM
  const pm = await createLoggedInAgent("PROPERTY_MANAGER");
  pmAgent = pm.agent;

  // Signup #2: Guest
  const guest = await createLoggedInAgent("GUEST");
  guestAgent = guest.agent;
});

describe("Subscription endpoints", () => {
  // ── GET /api/subscriptions/plans ──────────────────────

  describe("GET /api/subscriptions/plans", () => {
    it("should return available plans for authenticated users", async () => {
      const res = await pmAgent.get("/api/subscriptions/plans");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        firstPlanId = res.body[0].id;
        expect(res.body[0]).toHaveProperty("id");
        expect(res.body[0]).toHaveProperty("name");
        expect(res.body[0]).toHaveProperty("features");
        expect(Array.isArray(res.body[0].features)).toBe(true);
      }
    });

    it("should reject unauthenticated requests", async () => {
      const res = await supertest(app).get("/api/subscriptions/plans");
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/subscriptions/checkout ──────────────────

  describe("POST /api/subscriptions/checkout", () => {
    it("should create a subscription for a Property Manager", async () => {
      if (!firstPlanId) {
        console.warn("No active plans found — skipping checkout test");
        return;
      }

      const res = await pmAgent.post("/api/subscriptions/checkout").send({
        planId: firstPlanId,
        cardLast4: "4242",
        cardBrand: "Visa",
        cardName: "Test User",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("subscription");
      expect(res.body).toHaveProperty("invoice");
      expect(res.body.subscription.planId).toBe(firstPlanId);
    });

    it("should reject non-PM users from subscribing", async () => {
      if (!firstPlanId) {
        console.warn("No active plans found — skipping checkout rejection test");
        return;
      }

      const res = await guestAgent.post("/api/subscriptions/checkout").send({
        planId: firstPlanId,
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/only property managers/i);
    });
  });

  // ── GET /api/subscriptions/current ────────────────────

  describe("GET /api/subscriptions/current", () => {
    it("should return active subscription for a subscribed PM", async () => {
      const res = await pmAgent.get("/api/subscriptions/current");

      expect(res.status).toBe(200);
      // The PM subscribed in the checkout test above
      if (firstPlanId) {
        expect(res.body).not.toBeNull();
        expect(res.body).toHaveProperty("plan_id");
        expect(res.body).toHaveProperty("features");
      }
    });
  });
});
