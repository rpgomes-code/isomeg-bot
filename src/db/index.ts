import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";
import { pgTableCreator } from "drizzle-orm/pg-core";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables");
}

const client = postgres(connectionString, { max: 5 });
export const db = drizzle(client, { schema, casing: "snake_case" });

/**
 * Reusable table creator with project prefix. Useful for multi-project databases.
 * Use this instead of pgTable if you need namespaced tables.
 */
export const projectTable = pgTableCreator((name) => `isomeg_${name}`);
