import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { app } from "./setup.js";

describe("Upload security", () => {
  describe("POST /api/upload", () => {
    it("should reject unauthenticated upload requests with 401", async () => {
      const res = await supertest(app)
        .post("/api/upload")
        .attach("file", Buffer.from("test content"), "test.txt");

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/authentication required/i);
    });
  });
});
