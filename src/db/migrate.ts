import { existsSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables");
}

export async function runMigrations(): Promise<void> {
    console.log("[Migrations] Checking for unapplied migrations...");

    if (connectionString.startsWith("file:") || connectionString.startsWith("sqlite")) {
        console.log("[Migrations] Skipping migrations for non-PostgreSQL driver.");
        return;
    }

    if (!existsSync("./drizzle")) {
        console.log("[Migrations] No migration files found; skipping migration step.");
        return;
    }

    const client = postgres(connectionString, { max: 1 });
    const migrationDb = drizzle(client);

    try {
        await migrate(migrationDb, { migrationsFolder: "./drizzle" });
        console.log("[Migrations] All migrations applied.");
    } finally {
        await client.end();
    }
}
