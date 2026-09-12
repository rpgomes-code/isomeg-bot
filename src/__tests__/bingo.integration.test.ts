import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BingoCard } from "../db/schema";

const describeDb = process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeDb("bingo database integration", () => {
    let bingo: typeof import("../lib/bingo");
    let db: typeof import("../db").db;
    let schema: typeof import("../db/schema");
    let eq: typeof import("drizzle-orm").eq;
    const guildId = "bingo-" + randomUUID().slice(0, 16);
    const owner = "card-owner";

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
        await db.delete(schema.bingoCards).where(eq(schema.bingoCards.guildId, guildId));
        await db.delete(schema.guilds).where(eq(schema.guilds.guildId, guildId));
    });

    const createCard = () => bingo.createBingoCard(guildId, owner, "Showcase");

    async function fillCard(card: BingoCard): Promise<BingoCard> {
        for (let start = 0; start < 25; start += 5) {
            card = await bingo.updateBingoCard(card.id, guildId, owner, {
                type: "edit", revision: card.revision, start,
                values: Array.from({ length: 5 }, (_, offset) => "Prediction " + (start + offset)),
            });
        }
        return card;
    }

    it("creates named cards without an event, allowing multiple cards per person", async () => {
        const first = await bingo.createBingoCard(guildId, owner, "  Game\n  Showcase  ");
        const second = await createCard();
        expect(first.title).toBe("Game Showcase");
        expect(first.eventId).toBeNull();
        expect(first.predictions).toEqual(Array(25).fill(""));
        expect(first.marks).toBe(0);
        expect(first.submittedAt).toBeNull();
        expect(first.id).not.toBe(second.id);
        await expect(bingo.createBingoCard(guildId, owner, " ")).rejects.toThrow("name");
        await expect(bingo.createBingoCard(guildId, owner, "x".repeat(101))).rejects.toThrow("name");
    });

    it("allows only the creator to edit, confirm, and mark", async () => {
        let card = await fillCard(await createCard());
        const actions: Parameters<typeof bingo.updateBingoCard>[3][] = [
            { type: "edit", revision: card.revision, start: 0, values: ["Injected prediction"] },
            { type: "confirm", revision: card.revision },
            { type: "mark", revision: card.revision, index: 0 },
        ];
        for (const userId of ["server-admin", "another-member"]) {
            for (const action of actions) {
                await expect(bingo.updateBingoCard(card.id, guildId, userId, action)).rejects.toThrow("Only the person who created");
            }
        }
        card = await bingo.updateBingoCard(card.id, guildId, owner, { type: "confirm", revision: card.revision });
        await expect(bingo.updateBingoCard(card.id, guildId, "server-admin", { type: "mark", revision: card.revision, index: 0 }))
            .rejects.toThrow("Only the person who created");
        const stored = await bingo.getBingoCard(card.id, guildId);
        expect(stored.predictions[0]).toBe("Prediction 0");
        expect(stored.marks).toBe(0);
    });

    it("locks confirmed predictions permanently and immediately allows marking and unmarking", async () => {
        let card = await createCard();
        await expect(bingo.updateBingoCard(card.id, guildId, owner, { type: "confirm", revision: 0 })).rejects.toThrow("Fill all 25");
        await expect(bingo.updateBingoCard(card.id, guildId, owner, { type: "mark", revision: 0, index: 0 })).rejects.toThrow("Confirm your choices");
        card = await fillCard(card);
        card = await bingo.updateBingoCard(card.id, guildId, owner, { type: "confirm", revision: card.revision });
        const confirmedAt = card.submittedAt;
        expect(confirmedAt).toBeInstanceOf(Date);
        await expect(bingo.updateBingoCard(card.id, guildId, owner, { type: "edit", revision: card.revision, start: 0, values: ["Too late"] }))
            .rejects.toThrow("locked");
        await expect(bingo.updateBingoCard(card.id, guildId, owner, { type: "confirm", revision: card.revision })).rejects.toThrow("locked");
        for (let index = 0; index < 5; index++) {
            card = await bingo.updateBingoCard(card.id, guildId, owner, { type: "mark", revision: card.revision, index });
        }
        expect((await bingo.getBingoCard(card.id, guildId)).marks).toBe(31);
        card = await bingo.updateBingoCard(card.id, guildId, owner, { type: "mark", revision: card.revision, index: 4 });
        expect(card.marks).toBe(15);
        expect(card.submittedAt).toEqual(confirmedAt);
        expect(card.predictions[0]).toBe("Prediction 0");
    });

    it("rejects duplicate choices when confirming, leaving the draft editable", async () => {
        let card = await fillCard(await createCard());
        card = await bingo.updateBingoCard(card.id, guildId, owner, {
            type: "edit", revision: card.revision, start: 1, values: ["PREDICTION 0"],
        });
        await expect(bingo.updateBingoCard(card.id, guildId, owner, { type: "confirm", revision: card.revision })).rejects.toThrow("different prediction");
        expect((await bingo.getBingoCard(card.id, guildId)).submittedAt).toBeNull();
    });

    it("rejects cross-server access and invalid IDs", async () => {
        const card = await createCard();
        await expect(bingo.getBingoCard(card.id, "different-guild")).rejects.toThrow("in this server");
        await expect(bingo.updateBingoCard(card.id, "different-guild", owner, { type: "confirm", revision: 0 })).rejects.toThrow("in this server");
        await expect(bingo.getBingoCard("not-a-uuid", guildId)).rejects.toThrow("invalid");
    });

    it("prevents stale forms, stale confirmation, and simultaneous edit overwrites", async () => {
        const card = await createCard();
        const edits = await Promise.allSettled(["First", "Second"].map(value => bingo.updateBingoCard(card.id, guildId, owner, {
            type: "edit", revision: 0, start: 0, values: [value],
        })));
        expect(edits.filter(result => result.status === "fulfilled")).toHaveLength(1);
        expect(edits.filter(result => result.status === "rejected")).toHaveLength(1);
        await expect(bingo.updateBingoCard(card.id, guildId, owner, { type: "edit", revision: 0, start: 1, values: ["Old modal"] }))
            .rejects.toThrow("has changed");
        await expect(bingo.updateBingoCard(card.id, guildId, owner, { type: "confirm", revision: 0 })).rejects.toThrow("has changed");
        expect((await bingo.getBingoCard(card.id, guildId)).predictions[1]).toBe("");
    });

    it("avoids double toggles from simultaneous clicks on the same revision", async () => {
        let card = await fillCard(await createCard());
        card = await bingo.updateBingoCard(card.id, guildId, owner, { type: "confirm", revision: card.revision });
        const clicks = await Promise.allSettled([0, 0].map(index => bingo.updateBingoCard(card.id, guildId, owner, {
            type: "mark", revision: card.revision, index,
        })));
        expect(clicks.filter(result => result.status === "fulfilled")).toHaveLength(1);
        expect(clicks.filter(result => result.status === "rejected")).toHaveLength(1);
        expect((await bingo.getBingoCard(card.id, guildId)).marks).toBe(1);
    });

    it("lists only the owner's cards in this server with non-overlapping pages", async () => {
        const player = "pagination-player";
        for (let i = 0; i < 26; i++) await bingo.createBingoCard(guildId, player, "Card " + i);
        const first = await bingo.listBingoCards(guildId, player);
        const second = await bingo.listBingoCards(guildId, player, 1);
        expect(first.cards).toHaveLength(25);
        expect(first.hasMore).toBe(true);
        expect(second.cards).toHaveLength(1);
        expect(second.hasMore).toBe(false);
        expect(new Set([...first.cards, ...second.cards].map(card => card.id)).size).toBe(26);
        expect(first.cards.every(card => card.createdById === player && card.guildId === guildId)).toBe(true);
        expect((await bingo.listBingoCards("different-guild", player)).cards).toEqual([]);
        expect((await bingo.listBingoCards(guildId, "no-cards-player")).cards).toEqual([]);
        await expect(bingo.listBingoCards(guildId, owner, -1)).rejects.toThrow("invalid");
    });
});
