import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { bingoCards, type BingoCard } from "../db/schema";
import {
    assertCardEditable, assertCardOwner, assertCardRevision, assertCompleteCard,
    BINGO_SQUARES, BingoError, editPredictions, validateBingoId,
} from "./bingoRules";

export const BINGO_LIST_PAGE_SIZE = 25;

export async function createBingoCard(guildId: string, userId: string, title: string): Promise<BingoCard> {
    const normalized = title.trim().replace(/\s+/g, " ");
    if (!normalized || normalized.length > 100) throw new BingoError("A card name must contain 1-100 characters.");
    const [card] = await db.insert(bingoCards).values({
        guildId, createdById: userId, title: normalized, predictions: Array(BINGO_SQUARES).fill(""),
    }).returning();
    return card;
}

export async function getBingoCard(cardId: string, guildId: string): Promise<BingoCard> {
    validateBingoId(cardId);
    const [card] = await db.select().from(bingoCards)
        .where(and(eq(bingoCards.id, cardId), eq(bingoCards.guildId, guildId)));
    if (!card) throw new BingoError("This bingo card no longer exists in this server.");
    return card;
}

export async function listBingoCards(guildId: string, userId: string, page = 0) {
    if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw new BingoError("That card list page is invalid.");
    const rows = await db.select().from(bingoCards)
        .where(and(eq(bingoCards.guildId, guildId), eq(bingoCards.createdById, userId)))
        .orderBy(desc(bingoCards.createdAt), desc(bingoCards.id))
        .offset(page * BINGO_LIST_PAGE_SIZE).limit(BINGO_LIST_PAGE_SIZE + 1);
    return { cards: rows.slice(0, BINGO_LIST_PAGE_SIZE), page, hasMore: rows.length > BINGO_LIST_PAGE_SIZE };
}

export type BingoCardAction =
    | { type: "edit"; revision: number; start: number; values: string[] }
    | { type: "mark"; revision: number; index: number }
    | { type: "confirm"; revision: number };

export async function updateBingoCard(cardId: string, guildId: string, userId: string, action: BingoCardAction): Promise<BingoCard> {
    validateBingoId(cardId);
    return db.transaction(async tx => {
        // Lock this card while checking ownership, confirmation and revision together.
        const [card] = await tx.select().from(bingoCards)
            .where(and(eq(bingoCards.id, cardId), eq(bingoCards.guildId, guildId))).for("update");
        if (!card) throw new BingoError("This bingo card no longer exists in this server.");
        assertCardOwner(card, userId);
        assertCardRevision(card, action.revision);
        const changes: Partial<typeof bingoCards.$inferInsert> = { revision: card.revision + 1 };
        switch (action.type) {
            case "edit":
                assertCardEditable(card);
                changes.predictions = editPredictions(card.predictions, action.start, action.values);
                break;
            case "confirm":
                assertCardEditable(card);
                assertCompleteCard(card.predictions);
                changes.submittedAt = new Date();
                break;
            case "mark":
                if (!card.submittedAt) throw new BingoError("Confirm your choices before marking squares.");
                if (!Number.isInteger(action.index) || action.index < 0 || action.index >= BINGO_SQUARES) {
                    throw new BingoError("That square is invalid.");
                }
                changes.marks = card.marks ^ (1 << action.index);
                break;
            default:
                throw new BingoError("That card action is invalid.");
        }
        const [updated] = await tx.update(bingoCards).set(changes)
            .where(and(eq(bingoCards.id, cardId), eq(bingoCards.createdById, userId))).returning();
        return updated;
    });
}
