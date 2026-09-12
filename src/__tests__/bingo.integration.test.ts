import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BingoView } from "../lib/bingo";

const describeDb = process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeDb("bingo database integration", () => {
    let bingo: typeof import("../lib/bingo");
    let db: typeof import("../db").db;
    let schema: typeof import("../db/schema");
    let eq: typeof import("drizzle-orm").eq;
    const guildId = `bingo-${randomUUID().slice(0, 16)}`;
    const owner = "card-owner";
    const host = "event-host";

    beforeAll(async () => {
        const { runMigrations } = await import("../db/migrate");
        await runMigrations();
        bingo = await import("../lib/bingo");
        ({ db } = await import("../db"));
        schema = await import("../db/schema");
        ({ eq } = await import("drizzle-orm"));
        await db.insert(schema.guilds).values({ guildId, guildName: "Bingo Tests" });
    });

    afterAll(async () => {
        if (!db) return;
        await db.delete(schema.bingoEvents).where(eq(schema.bingoEvents.guildId, guildId));
        await db.delete(schema.guilds).where(eq(schema.guilds.guildId, guildId));
    });

    async function createCard(): Promise<BingoView> {
        const event = await bingo.createBingoEvent(guildId, host, "Showcase");
        return bingo.joinBingoEvent(event.id, guildId, owner);
    }

    async function fillCard(view: BingoView): Promise<BingoView> {
        for (let start = 0; start < 25; start += 5) {
            view = await bingo.updateBingoCard(view.card.id, guildId, owner, {
                type: "edit", revision: view.card.revision, start,
                values: Array.from({ length: 5 }, (_, offset) => `Prediction ${start + offset}`),
            });
        }
        return view;
    }

    it("allows only the card creator to edit, submit, unlock or mark, including against the host", async () => {
        let view = await fillCard(await createCard());
        const actions: Parameters<typeof bingo.updateBingoCard>[3][] = [
            { type: "edit", revision: view.card.revision, start: 0, values: ["Injected prediction"] },
            { type: "submit" }, { type: "unlock" },
        ];
        for (const userId of [host, "another-member"]) {
            for (const action of actions) {
                await expect(bingo.updateBingoCard(view.card.id, guildId, userId, action))
                    .rejects.toThrow("Only the person who created");
            }
        }
        view = await bingo.updateBingoCard(view.card.id, guildId, owner, { type: "submit" });
        await bingo.changeBingoEvent(view.event.id, guildId, host, "live");
        await expect(bingo.updateBingoCard(view.card.id, guildId, host, { type: "mark", revision: view.card.revision, index: 0 }))
            .rejects.toThrow("Only the person who created");
        const stored = await bingo.getBingoCard(view.card.id, guildId);
        expect(stored.card.predictions[0]).toBe("Prediction 0");
        expect(stored.card.marks).toBe(0);
    });

    it("persists the full draft, submit, live mark/unmark, and final results lifecycle", async () => {
        let view = await createCard();
        await expect(bingo.updateBingoCard(view.card.id, guildId, owner, { type: "submit" })).rejects.toThrow("Fill all 25");
        await expect(bingo.updateBingoCard(view.card.id, guildId, owner, { type: "mark", revision: 0, index: 0 })).rejects.toThrow("while the event is live");
        view = await fillCard(view);
        view = await bingo.updateBingoCard(view.card.id, guildId, owner, { type: "submit" });
        await expect(bingo.updateBingoCard(view.card.id, guildId, owner, { type: "edit", revision: view.card.revision, start: 0, values: ["Too late"] })).rejects.toThrow("submitted");
        view = await bingo.updateBingoCard(view.card.id, guildId, owner, { type: "unlock" });
        expect(view.card.submittedAt).toBeNull();
        view = await bingo.updateBingoCard(view.card.id, guildId, owner, { type: "submit" });
        await bingo.changeBingoEvent(view.event.id, guildId, host, "live");
        await expect(bingo.updateBingoCard(view.card.id, guildId, owner, { type: "unlock" })).rejects.toThrow("before the event starts");
        for (let index = 0; index < 5; index++) {
            view = await bingo.updateBingoCard(view.card.id, guildId, owner, { type: "mark", revision: view.card.revision, index });
        }
        expect((await bingo.getBingoCard(view.card.id, guildId)).card.marks).toBe(31);
        view = await bingo.updateBingoCard(view.card.id, guildId, owner, { type: "mark", revision: view.card.revision, index: 4 });
        expect(view.card.marks).toBe(15);
        await bingo.changeBingoEvent(view.event.id, guildId, host, "ended");
        await expect(bingo.updateBingoCard(view.card.id, guildId, owner, { type: "mark", revision: view.card.revision, index: 4 })).rejects.toThrow("while the event is live");
        const results = await bingo.getBingoResults(view.event.id, guildId);
        expect(results.event.status).toBe("ended");
        expect(results.cards[0].marks).toBe(15);
    });

    it("rejects cross-server access, invalid IDs, and host actions by other players", async () => {
        const view = await createCard();
        await expect(bingo.getBingoCard(view.card.id, "different-guild")).rejects.toThrow("in this server");
        await expect(bingo.getBingoResults(view.event.id, "different-guild")).rejects.toThrow("in this server");
        await expect(bingo.updateBingoCard(view.card.id, "different-guild", owner, { type: "submit" })).rejects.toThrow("in this server");
        await expect(bingo.getBingoCard("not-a-uuid", guildId)).rejects.toThrow("invalid");
        await expect(bingo.changeBingoEvent(view.event.id, guildId, owner, "live")).rejects.toThrow("Only the event creator");
    });

    it("prevents duplicate joins, stale forms and simultaneous overwrites", async () => {
        const view = await createCard();
        const joins = await Promise.all([bingo.joinBingoEvent(view.event.id, guildId, owner), bingo.joinBingoEvent(view.event.id, guildId, owner)]);
        expect(joins.every(join => join.card.id === view.card.id)).toBe(true);
        const edits = await Promise.allSettled(["First", "Second"].map(value => bingo.updateBingoCard(view.card.id, guildId, owner, {
            type: "edit", revision: 0, start: 0, values: [value],
        })));
        expect(edits.filter(result => result.status === "fulfilled")).toHaveLength(1);
        expect(edits.filter(result => result.status === "rejected")).toHaveLength(1);
        await expect(bingo.updateBingoCard(view.card.id, guildId, owner, { type: "edit", revision: 0, start: 1, values: ["Old modal"] }))
            .rejects.toThrow("out of date");
        expect((await bingo.getBingoCard(view.card.id, guildId)).card.predictions[1]).toBe("");
    });

    it("locks unfinished cards and registration once the event starts", async () => {
        const view = await createCard();
        await bingo.changeBingoEvent(view.event.id, guildId, host, "live");
        await expect(bingo.joinBingoEvent(view.event.id, guildId, "late-player")).rejects.toThrow("no longer accepting");
        await expect(bingo.updateBingoCard(view.card.id, guildId, owner, { type: "edit", revision: 0, start: 0, values: ["After reveal"] })).rejects.toThrow("locked");
        await expect(bingo.updateBingoCard(view.card.id, guildId, owner, { type: "submit" })).rejects.toThrow("locked");
        await expect(bingo.updateBingoCard(view.card.id, guildId, owner, { type: "mark", revision: 0, index: 0 })).rejects.toThrow("Only submitted cards");
    });
});
