import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { app } from "./setup.js";

describe("Public / booking endpoints", () => {
  // ── GET /api/public/areas ─────────────────────────────

  describe("GET /api/public/areas", () => {
    it("should return an array of areas", async () => {
      const res = await supertest(app).get("/api/public/areas");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Each area should have basic fields
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("id");
        expect(res.body[0]).toHaveProperty("name");
      }
    });
  });

  // ── GET /api/health ───────────────────────────────────

  describe("GET /api/health", () => {
    it("should return ok status", async () => {
      const res = await supertest(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("version");
      expect(res.body).toHaveProperty("timestamp");
    });
  });
});
