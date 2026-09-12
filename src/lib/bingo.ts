import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { bingoCards, bingoEvents, type BingoCard, type BingoEvent } from "../db/schema";
import {
    assertCardEditable, assertCardOwner, assertCardRevision, assertCompleteCard,
    BINGO_SQUARES, BingoError, editPredictions, validateBingoId,
} from "./bingoRules";

export type BingoView = { event: BingoEvent; card: BingoCard };
type BingoTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockEvent(tx: BingoTransaction, eventId: string, guildId: string): Promise<BingoEvent> {
    validateBingoId(eventId);
    const [event] = await tx.select().from(bingoEvents)
        .where(and(eq(bingoEvents.id, eventId), eq(bingoEvents.guildId, guildId))).for("update");
    if (!event) throw new BingoError("No bingo event found with that ID in this server.");
    return event;
}

export async function createBingoEvent(guildId: string, userId: string, title: string): Promise<BingoEvent> {
    const normalized = title.trim().replace(/\s+/g, " ");
    if (!normalized || normalized.length > 100) throw new BingoError("An event title must contain 1-100 characters.");
    const [event] = await db.insert(bingoEvents).values({ guildId, createdById: userId, title: normalized }).returning();
    return event;
}

export async function listBingoEvents(guildId: string): Promise<BingoEvent[]> {
    return db.select().from(bingoEvents).where(eq(bingoEvents.guildId, guildId))
        .orderBy(desc(bingoEvents.createdAt)).limit(10);
}

export async function joinBingoEvent(eventId: string, guildId: string, userId: string): Promise<BingoView> {
    return db.transaction(async tx => {
        const event = await lockEvent(tx, eventId, guildId);
        const [existing] = await tx.select().from(bingoCards)
            .where(and(eq(bingoCards.eventId, event.id), eq(bingoCards.createdById, userId)));
        if (existing) return { event, card: existing };
        if (event.status !== "open") throw new BingoError("This event is no longer accepting cards.");
        const [card] = await tx.insert(bingoCards).values({
            eventId: event.id, createdById: userId, predictions: Array(BINGO_SQUARES).fill(""),
        }).returning();
        return { event, card };
    });
}

export async function getBingoCard(cardId: string, guildId: string): Promise<BingoView> {
    validateBingoId(cardId);
    const [view] = await db.select({ card: bingoCards, event: bingoEvents }).from(bingoCards)
        .innerJoin(bingoEvents, eq(bingoCards.eventId, bingoEvents.id))
        .where(and(eq(bingoCards.id, cardId), eq(bingoEvents.guildId, guildId)));
    if (!view) throw new BingoError("No bingo card found with that ID in this server.");
    return view;
}

type CardAction =
    | { type: "edit"; revision: number; start: number; values: string[] }
    | { type: "mark"; revision: number; index: number }
    | { type: "submit" | "unlock" };

export async function updateBingoCard(cardId: string, guildId: string, userId: string, action: CardAction): Promise<BingoView> {
    const initial = await getBingoCard(cardId, guildId);
    assertCardOwner(initial.card, userId);
    return db.transaction(async tx => {
        // Every mutation locks the event first, so starting/ending cannot race a card update.
        const event = await lockEvent(tx, initial.event.id, guildId);
        const [card] = await tx.select().from(bingoCards).where(eq(bingoCards.id, cardId)).for("update");
        if (!card) throw new BingoError("This bingo card no longer exists.");
        assertCardOwner(card, userId);
        if ("revision" in action) assertCardRevision(card, action.revision);
        const changes: Partial<typeof bingoCards.$inferInsert> = { revision: card.revision + 1 };
        if (action.type === "edit") {
            assertCardEditable(event, card);
            changes.predictions = editPredictions(card.predictions, action.start, action.values);
        } else if (action.type === "mark") {
            if (event.status !== "live" || !card.submittedAt) throw new BingoError("Only submitted cards can be marked while the event is live.");
            if (!Number.isInteger(action.index) || action.index < 0 || action.index >= BINGO_SQUARES) throw new BingoError("That square is invalid.");
            changes.marks = card.marks ^ (1 << action.index);
        } else if (action.type === "submit") {
            assertCardEditable(event, card);
            assertCompleteCard(card.predictions);
            changes.submittedAt = new Date();
        } else {
            if (event.status !== "open") throw new BingoError("Cards can only be unlocked before the event starts.");
            changes.submittedAt = null;
        }
        const [updated] = await tx.update(bingoCards).set(changes)
            .where(and(eq(bingoCards.id, cardId), eq(bingoCards.createdById, userId))).returning();
        return { event, card: updated };
    });
}

export async function changeBingoEvent(eventId: string, guildId: string, userId: string, status: "live" | "ended"): Promise<BingoEvent> {
    return db.transaction(async tx => {
        const event = await lockEvent(tx, eventId, guildId);
        if (event.createdById !== userId) throw new BingoError("Only the event creator can start or end this event.");
        if (status === "live" && event.status !== "open") throw new BingoError("Only an open event can be started.");
        if (status === "ended" && event.status !== "live") throw new BingoError("Only a live event can be ended.");
        const [updated] = await tx.update(bingoEvents).set({ status }).where(eq(bingoEvents.id, eventId)).returning();
        return updated;
    });
}

export async function getBingoResults(eventId: string, guildId: string): Promise<{ event: BingoEvent; cards: BingoCard[] }> {
    return db.transaction(async tx => {
        const event = await lockEvent(tx, eventId, guildId);
        const cards = await tx.select().from(bingoCards).where(eq(bingoCards.eventId, eventId));
        return { event, cards };
    });
}
