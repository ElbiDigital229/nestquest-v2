/**
 * Session Store Factory
 *
 * Returns the best available session store:
 *   1. Redis (if REDIS_URL is set) — fastest, enables horizontal scaling
 *   2. PostgreSQL (always available) — reliable fallback
 *
 * Redis enables multiple server instances to share sessions (required for
 * horizontal scaling behind a load balancer). Without Redis, sticky sessions
 * or single-instance deployment is required.
 *
 * Environment variables:
 *   REDIS_URL     — redis://[:password@]host:port  (e.g. redis://localhost:6379)
 *
 * Fallback is automatic — if Redis is unreachable at startup, the process
 * logs a warning and falls back to PostgreSQL sessions.
 */

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "../db/index";
import logger from "./logger";

async function buildSessionStore(): Promise<session.Store> {
  if (process.env.REDIS_URL) {
    try {
      const { default: Redis } = await import("ioredis");
      const { RedisStore } = await import("connect-redis");

      const client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      // Test the connection before committing to Redis
      await client.connect();
      await client.ping();

      client.on("error", (err) => {
        logger.error({ err }, "Redis session store error");
      });

      client.on("reconnecting", () => {
        logger.warn("Redis session store reconnecting");
      });

      logger.info({ url: process.env.REDIS_URL.replace(/:\/\/.*@/, "://*@") }, "Using Redis session store");

      return new RedisStore({ client, prefix: "nq:sess:" });
    } catch (err: any) {
      logger.warn({ err: err.message }, "Redis unavailable — falling back to PostgreSQL sessions");
    }
  }

  const PgSession = connectPgSimple(session);
  logger.info("Using PostgreSQL session store");

  return new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: true,
    // Prune expired sessions every 15 minutes
    pruneSessionInterval: 15 * 60,
  });
}

export { buildSessionStore };
