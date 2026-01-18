import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// For use in queries
const client = postgres(connectionString);

export const db = drizzle(client, { schema });

// Export schema for convenience
export * from "./schema";
