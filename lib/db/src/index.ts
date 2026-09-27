import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle> | any = null;

try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  } else {
    console.warn("[AI Studio] DATABASE_URL not set — database client disabled");
  }
} catch (error) {
  console.warn("[AI Studio] Database connection error:", error);
}

export { pool, db };
export * from "./schema";
