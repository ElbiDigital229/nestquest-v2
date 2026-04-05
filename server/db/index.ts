import pg from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../shared/schema";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually (no dotenv dependency needed)
try {
  const envPath = resolve(process.cwd(), ".env");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });

/**
 * Shared type for db or a transaction client.
 * Both have the same .execute() interface.
 */
export type DbClient = NodePgDatabase<typeof schema>;

/**
 * Run a set of operations inside a single atomic transaction.
 * Any thrown error triggers ROLLBACK automatically via Drizzle.
 *
 * Usage:
 *   await withTransaction(async (tx) => {
 *     await tx.execute(sql`UPDATE ...`);
 *     await someUtil(data, tx);
 *   });
 */
export async function withTransaction<T>(
  fn: (tx: DbClient) => Promise<T>
): Promise<T> {
  return db.transaction(fn as any);
}
