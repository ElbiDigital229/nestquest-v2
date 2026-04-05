/**
 * Swagger / OpenAPI 3.0 setup
 *
 * Served at GET /api/docs  (JSON spec at GET /api/docs.json)
 *
 * To add docs to a route, use JSDoc @openapi annotations in the route/service files:
 *
 *   /**
 *    * @openapi
 *    * /api/bookings:
 *    *   post:
 *    *     summary: Create a booking
 *    *     ...
 *    *\/
 */

import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "NestQuest API",
      version: "2.0.0",
      description: "Short-term rental management platform API (UAE)",
      contact: {
        name: "NestQuest",
      },
    },
    servers: [
      {
        url: "/api",
        description: "Current server",
      },
    ],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "nq.sid",
          description: "Session cookie (set automatically on login)",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        Booking: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            status: {
              type: "string",
              enum: ["requested", "confirmed", "checked_in", "checked_out", "completed", "cancelled", "declined"],
            },
            checkInDate: { type: "string", format: "date" },
            checkOutDate: { type: "string", format: "date" },
            numberOfGuests: { type: "integer" },
            totalNights: { type: "integer" },
            totalAmount: { type: "string", example: "1500.00" },
            paymentStatus: { type: "string", enum: ["pending", "paid", "refunded", "failed"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        PriceBreakdown: {
          type: "object",
          properties: {
            totalNights: { type: "integer" },
            weekdayNights: { type: "integer" },
            weekendNights: { type: "integer" },
            nightlyRate: { type: "string" },
            weekendRate: { type: "string" },
            nightlyTotal: { type: "string" },
            cleaningFee: { type: "string" },
            subtotal: { type: "string" },
            tourismTax: { type: "string" },
            tourismTaxPercent: { type: "number" },
            vat: { type: "string" },
            vatPercent: { type: "number" },
            securityDeposit: { type: "string" },
            total: { type: "string" },
          },
        },
      },
    },
    security: [{ sessionCookie: [] }],
    tags: [
      { name: "Auth", description: "Authentication and session management" },
      { name: "Bookings", description: "Booking lifecycle management" },
      { name: "Properties", description: "Short-term property management" },
      { name: "Payments", description: "Stripe payment integration" },
      { name: "Portal", description: "Guest portal endpoints" },
      { name: "Admin", description: "Super admin endpoints" },
      { name: "Health", description: "Health and status checks" },
    ],
  },
  apis: [
    "./server/routes/*.ts",
    "./server/services/*.ts",
    "./server/controllers/*.ts",
    "./server/index.ts",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.get("/api/docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(swaggerSpec);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "NestQuest API Docs",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    })
  );
}
