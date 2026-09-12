import { describe, expect, it } from "vitest";
import { assertCompleteCard, completedLines, editPredictions, markedCount } from "../lib/bingoRules";
import { bingoCardPayload, bingoEditModal, bingoResultsEmbed } from "../lib/bingoPresentation";
import type { BingoCard, BingoEvent } from "../db/schema";

const event: BingoEvent = {
    id: "00000000-0000-4000-8000-000000000001", guildId: "guild", createdById: "host",
    title: "Game Showcase", status: "open", createdAt: new Date(),
};
const card: BingoCard = {
    id: "00000000-0000-4000-8000-000000000002", eventId: event.id, createdById: "player",
    predictions: Array.from({ length: 25 }, (_, i) => `Announcement ${i + 1}`),
    marks: 0, revision: 0, submittedAt: null, createdAt: new Date(),
};
const mask = (indices: number[]) => indices.reduce((marks, index) => marks | (1 << index), 0);

describe("bingo lines", () => {
    it.each([
        [[0, 1, 2, 3, 4], "Row 1"],
        [[20, 21, 22, 23, 24], "Row 5"],
        [[0, 5, 10, 15, 20], "Column A"],
        [[4, 9, 14, 19, 24], "Column E"],
        [[0, 6, 12, 18, 24], "Diagonal A1-E5"],
        [[4, 8, 12, 16, 20], "Diagonal E1-A5"],
    ] as [number[], string][]) ("recognizes %j", (indices, name) => {
        expect(completedLines(mask(indices))).toEqual([name]);
        expect(completedLines(mask(indices.slice(0, 4)))).toEqual([]);
    });

    it("counts all 12 lines on a full card and removes lines when unmarked", () => {
        const full = (1 << 25) - 1;
        expect(completedLines(full)).toHaveLength(12);
        expect(markedCount(full)).toBe(25);
        expect(completedLines(full ^ (1 << 12))).toHaveLength(8);
        expect(completedLines(0)).toEqual([]);
    });
});

describe("prediction validation", () => {
    it("requires 25 nonempty, unique predictions on submission", () => {
        expect(() => assertCompleteCard(card.predictions)).not.toThrow();
        expect(() => assertCompleteCard([...card.predictions.slice(1), " "])).toThrow("Fill all 25");
        expect(() => assertCompleteCard([...card.predictions.slice(1), "ANNOUNCEMENT 2"])).toThrow("different prediction");
    });

    it("edits a row without changing other rows or mutating the old card", () => {
        const updated = editPredictions(card.predictions, 5, [" A\nB ", "C", "D", "E", "F"]);
        expect(updated.slice(5, 10)).toEqual(["A B", "C", "D", "E", "F"]);
        expect(updated.slice(10)).toEqual(card.predictions.slice(10));
        expect(card.predictions[5]).toBe("Announcement 6");
        expect(() => editPredictions(card.predictions, 24, ["A", "B", "C", "D", "E"])).toThrow("invalid");
        expect(() => editPredictions(card.predictions, 0, ["x".repeat(81)])).toThrow("80 characters");
    });
});

describe("Discord bingo presentation", () => {
    it("fits a full card into Discord limits with 25 buttons and escaped predictions", () => {
        const payload = bingoCardPayload({ event, card: { ...card, predictions: Array(25).fill("*".repeat(80)) } });
        const embed = payload.embeds[0].toJSON();
        expect(payload.embeds[0].length).toBeLessThanOrEqual(6000);
        expect(embed.fields?.every(field => field.value.length <= 1024)).toBe(true);
        expect(payload.components).toHaveLength(5);
        for (const row of payload.components) {
            expect(row.toJSON().components).toHaveLength(5);
            expect(row.toJSON().components.every(button => "custom_id" in button && button.custom_id.length <= 100)).toBe(true);
        }
        expect(bingoEditModal(card, 20, 5).toJSON().components).toHaveLength(5);
        expect(bingoEditModal({ ...card, predictions: Array(25).fill("") }, 0, 1).toJSON()).toBeTruthy();
    });

    it("enables only draft editing or live marking and disables ended cards", () => {
        for (const status of ["open", "live", "ended"] as const) {
            for (const submitted of [false, true]) {
                const payload = bingoCardPayload({ event: { ...event, status }, card: { ...card, submittedAt: submitted ? new Date() : null } });
                const disabled = payload.components[0].toJSON().components[0].disabled;
                expect(disabled).toBe(!((status === "open" && !submitted) || (status === "live" && submitted)));
            }
        }
    });

    it("ranks submitted cards by lines and excludes drafts, with bounded pages", () => {
        const cards = Array.from({ length: 22 }, (_, index) => ({
            ...card, createdById: `player-${index}`, submittedAt: index ? new Date() : null, marks: index === 21 ? 31 : 0,
        }));
        const result = bingoResultsEmbed(event, cards, 1).toJSON();
        expect(result.description).toContain("**1.** <@player-21>");
        expect(result.description).not.toContain("<@player-0>");
        expect(result.footer?.text).toContain("Page 1/3");
        expect(bingoResultsEmbed(event, cards, 100).toJSON().footer?.text).toContain("Page 3/3");
    });
});
