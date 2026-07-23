import { afterEach, beforeAll, describe, expect, it } from "vitest";

const describeDb = process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeDb("warnings database integration", () => {
    let db: typeof import("../db").db;
    let guilds: typeof import("../db/schema").guilds;
    let warns: typeof import("../db/schema").warns;
    let addWarn: typeof import("../lib/moderation").addWarn;
    let getUserWarns: typeof import("../lib/moderation").getUserWarns;
    let deleteUserWarn: typeof import("../lib/moderation").deleteUserWarn;
    let eq: typeof import("drizzle-orm").eq;

    const guildId = `test-${Date.now()}`;
    const userId = `user-${Date.now()}`;
    const moderatorId = `mod-${Date.now()}`;

    beforeAll(async () => {
        const migrate = await import("../db/migrate");
        await migrate.runMigrations();

        ({ db } = await import("../db"));
        ({ guilds, warns } = await import("../db/schema"));
        ({ eq } = await import("drizzle-orm"));
        ({ addWarn, getUserWarns, deleteUserWarn } = await import("../lib/moderation"));

        await db.insert(guilds).values({ guildId, guildName: "Test Guild" }).onConflictDoNothing();
    });

    afterEach(async () => {
        await db.delete(warns).where(eq(warns.guildId, guildId));
        await db.delete(guilds).where(eq(guilds.guildId, guildId));
    });

    it("creates, lists, and soft-deletes warnings", async () => {
        await db.insert(guilds).values({ guildId, guildName: "Test Guild" }).onConflictDoNothing();

        const first = await addWarn(guildId, userId, moderatorId, "First warning");
        const second = await addWarn(guildId, userId, moderatorId, "Second warning");

        expect(first.id).toBeTruthy();
        expect(second.id).toBeTruthy();

        const activeWarnings = await getUserWarns(guildId, userId);
        expect(activeWarnings).toHaveLength(2);
        expect(activeWarnings.map((warning) => warning.reason).sort()).toEqual(["First warning", "Second warning"]);

        await expect(deleteUserWarn(first.id)).resolves.toBe(true);
        await expect(deleteUserWarn(first.id)).resolves.toBe(false);

        const remainingWarnings = await getUserWarns(guildId, userId);
        expect(remainingWarnings).toHaveLength(1);
        expect(remainingWarnings[0].id).toBe(second.id);
    });
});
