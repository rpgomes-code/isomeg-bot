import type { BingoCard, BingoEvent } from "../db/schema/bingo";

export const BINGO_SIZE = 5;
export const BINGO_SQUARES = BINGO_SIZE * BINGO_SIZE;
export const BINGO_PREDICTION_LENGTH = 80;

export class BingoError extends Error {}

export function validateBingoId(id: string): void {
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
        throw new BingoError("That bingo ID is invalid.");
    }
}

export function squareName(index: number): string {
    return `${String.fromCharCode(65 + index % BINGO_SIZE)}${Math.floor(index / BINGO_SIZE) + 1}`;
}

export function isMarked(marks: number, index: number): boolean {
    return (marks & (1 << index)) !== 0;
}

export function completedLines(marks: number): string[] {
    const lines: string[] = [];
    for (let i = 0; i < BINGO_SIZE; i++) {
        if (Array.from({ length: BINGO_SIZE }, (_, j) => i * BINGO_SIZE + j).every(index => isMarked(marks, index))) {
            lines.push(`Row ${i + 1}`);
        }
        if (Array.from({ length: BINGO_SIZE }, (_, j) => j * BINGO_SIZE + i).every(index => isMarked(marks, index))) {
            lines.push(`Column ${String.fromCharCode(65 + i)}`);
        }
    }
    if ([0, 6, 12, 18, 24].every(index => isMarked(marks, index))) lines.push("Diagonal A1-E5");
    if ([4, 8, 12, 16, 20].every(index => isMarked(marks, index))) lines.push("Diagonal E1-A5");
    return lines;
}

export function markedCount(marks: number): number {
    return Array.from({ length: BINGO_SQUARES }, (_, index) => isMarked(marks, index)).filter(Boolean).length;
}

export function assertCardOwner(card: BingoCard, userId: string): void {
    if (card.createdById !== userId) {
        throw new BingoError("Only the person who created this card can edit, submit, unlock, or mark it.");
    }
}

export function assertCardEditable(event: BingoEvent, card: BingoCard): void {
    if (event.status !== "open") throw new BingoError("Predictions are locked because this event has started or ended.");
    if (card.submittedAt) throw new BingoError("This card is submitted. Use /bingo unlock before editing it.");
}

export function assertCardRevision(card: BingoCard, revision: number): void {
    if (card.revision !== revision) throw new BingoError("This copy of the card is out of date. Open /bingo card for the latest version.");
}

export function editPredictions(predictions: string[], start: number, values: string[]): string[] {
    if (!Number.isInteger(start) || start < 0 || ![1, BINGO_SIZE].includes(values.length) || start + values.length > BINGO_SQUARES) {
        throw new BingoError("That square or row is invalid.");
    }
    const updated = [...predictions];
    values.forEach((value, offset) => {
        const normalized = value.trim().replace(/\s+/g, " ");
        if (normalized.length > BINGO_PREDICTION_LENGTH) throw new BingoError("Predictions can contain at most 80 characters.");
        updated[start + offset] = normalized;
    });
    return updated;
}

export function assertCompleteCard(predictions: string[]): void {
    if (predictions.length !== BINGO_SQUARES || predictions.some(value => !value.trim() || value.length > BINGO_PREDICTION_LENGTH)) {
        throw new BingoError("Fill all 25 squares before submitting your card.");
    }
    if (new Set(predictions.map(value => value.trim().toLowerCase())).size !== BINGO_SQUARES) {
        throw new BingoError("Each square needs a different prediction.");
    }
}
