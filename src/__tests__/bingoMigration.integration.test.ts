import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { describe, expect, it } from "vitest";

const describeDb = process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeDb("bingo saved-data migration", () => {
    it("preserves old draft and locked cards while making events optional", async () => {
        const databaseName = "bingo_migration_" + randomUUID().replace(/-/g, "");
        const url = new URL(process.env.DATABASE_URL!);
        const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
        let client: ReturnType<typeof postgres> | undefined;
        let created = false;
        const folder = await mkdtemp(join(tmpdir(), "isomeg-bingo-migration-"));
        try {
            await admin`CREATE DATABASE ${admin(databaseName)}`;
            created = true;
            url.pathname = "/" + databaseName;
            client = postgres(url.toString(), { max: 1, onnotice: () => {} });
            const migrationDb = drizzle(client);
            const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
            const oldEntries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 3);
            await mkdir(join(folder, "meta"));
            await writeFile(join(folder, "meta/_journal.json"), JSON.stringify({ ...journal, entries: oldEntries }));
            for (const entry of oldEntries) await copyFile(join("drizzle", entry.tag + ".sql"), join(folder, entry.tag + ".sql"));
            await migrate(migrationDb, { migrationsFolder: folder });

            await client`INSERT INTO guilds (guild_id, guild_name) VALUES ('legacy-guild', 'Legacy guild')`;
            const [event] = await client`INSERT INTO bingo_events (guild_id, created_by_id, title)
                VALUES ('legacy-guild', 'host', 'Existing Showcase') RETURNING id`;
            const predictions = Array.from({ length: 25 }, (_, index) => "Original prediction " + index);
            await client`INSERT INTO bingo_cards (event_id, created_by_id, predictions, marks, revision, submitted_at)
                VALUES (${event.id}, 'locked-owner', ${JSON.stringify(predictions)}::jsonb, 31, 7, '2026-09-01T12:00:00Z')`;
            await client`INSERT INTO bingo_cards (event_id, created_by_id, predictions)
                VALUES (${event.id}, 'draft-owner', ${JSON.stringify(Array(25).fill(""))}::jsonb)`;
            const before = await client`SELECT * FROM bingo_cards ORDER BY created_by_id`;

            await migrate(migrationDb, { migrationsFolder: "drizzle" });
            await migrate(migrationDb, { migrationsFolder: "drizzle" });
            const after = await client`SELECT * FROM bingo_cards ORDER BY created_by_id`;
            expect(after).toHaveLength(2);
            for (let i = 0; i < before.length; i++) {
                expect(after[i]).toMatchObject({ ...before[i], guild_id: "legacy-guild", title: "Existing Showcase" });
            }
            const [independent] = await client`INSERT INTO bingo_cards (guild_id, title, created_by_id, predictions)
                VALUES ('legacy-guild', 'New card', 'locked-owner', ${JSON.stringify(Array(25).fill(""))}::jsonb) RETURNING *`;
            expect(independent.event_id).toBeNull();
            expect(independent.submitted_at).toBeNull();
        } finally {
            await client?.end();
            if (created) await admin`DROP DATABASE ${admin(databaseName)}`;
            await admin.end();
            const target = resolve(folder);
            if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith("isomeg-bingo-migration-")) {
                throw new Error("Refusing to remove an unexpected migration test directory.");
            }
            await rm(target, { recursive: true, force: true });
        }
    }, 30000);
});
