import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: any;

const noOp = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (d: any) => d?.data ?? {},
  update: async (d: any) => d?.data ?? {},
  delete: async () => ({}),
};

const mockDb = new Proxy({}, {
  get: (_, prop) =>
    prop === "query"
      ? new Proxy({}, { get: () => noOp })
      : async () => [],
});

try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } else {
    console.warn("[AI Studio] DATABASE_URL not set — using in-memory mock");
    db = mockDb;
  }
} catch (error) {
  console.warn("[AI Studio] Database connection error — using in-memory mock:", error);
  db = mockDb;
}

export { pool, db };
export * from "./schema";
