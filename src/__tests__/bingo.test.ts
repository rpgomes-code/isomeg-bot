import { describe, expect, it } from "vitest";
import { ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import { assertCompleteCard, completedLines, editPredictions, markedCount } from "../lib/bingoRules";
import { bingoCardPayload, bingoCardPicker, bingoCardUpdate, bingoChoicesEmbed, bingoEditModal } from "../lib/bingoPresentation";
import type { BingoCard } from "../db/schema";

const card: BingoCard = {
    id: "00000000-0000-4000-8000-000000000002", eventId: null, guildId: "guild", title: "Game Showcase", createdById: "123",
    predictions: Array.from({ length: 25 }, (_, i) => "Announcement " + (i + 1)),
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
    it("renders all 25 editable squares and confirmation together within V2 limits", () => {
        const payload = bingoCardPayload(card);
        const container = payload.components[0].toJSON();
        const rows = container.components.filter(component => component.type === ComponentType.ActionRow);
        expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
        expect(payload).not.toHaveProperty("embeds");
        expect(payload).not.toHaveProperty("content");
        expect(rows).toHaveLength(6);
        expect(rows.slice(0, 5).flatMap(row => row.components)).toHaveLength(25);
        for (const row of rows.slice(0, 5)) {
            expect(row.components).toHaveLength(5);
            for (const button of row.components) {
                expect(button).toMatchObject({ type: ComponentType.Button, style: ButtonStyle.Secondary });
                expect("custom_id" in button && button.custom_id.length <= 100).toBe(true);
                expect("disabled" in button && button.disabled).toBeFalsy();
            }
        }
        expect(rows[5].components[0]).toMatchObject({ label: "Confirm Choices", disabled: false });
        const componentCount = 1 + container.components.length + rows.reduce((sum, row) => sum + row.components.length, 0);
        expect(componentCount).toBeLessThanOrEqual(40);
    });

    it("disables confirmation until all 25 squares contain choices", () => {
        const incomplete = { ...card, predictions: [...card.predictions.slice(0, 24), ""] };
        const container = bingoCardPayload(incomplete).components[0].toJSON();
        const rows = container.components.filter(component => component.type === ComponentType.ActionRow);
        expect(rows[5].components[0]).toMatchObject({ label: "Confirm Choices", disabled: true });
        expect(JSON.stringify(container)).toContain("24/25 choices");
        expect(JSON.stringify(rows[4].components[4])).toContain("E5 +");
    });

    it("keeps all locked squares interactive and exposes line results on the card", () => {
        const container = bingoCardPayload({ ...card, submittedAt: new Date(), marks: 31 }).components[0].toJSON();
        const rows = container.components.filter(component => component.type === ComponentType.ActionRow);
        expect(rows[0].components[0]).toMatchObject({ label: "A1 [X] Announcement 1", style: ButtonStyle.Success });
        expect(rows[1].components[0]).toMatchObject({ style: ButtonStyle.Secondary });
        expect(rows[5].components[0]).toMatchObject({ label: "Check", disabled: false });
        expect(JSON.stringify(container)).toContain("BINGO!** Row 1");
        expect(JSON.stringify(container)).not.toContain("Confirm Choices");
        expect(JSON.stringify(container)).not.toContain('"disabled":true');
    });

    it("clears legacy content and embeds when updating a card", () => {
        expect(bingoCardUpdate(card)).toMatchObject({ content: null, embeds: [], flags: MessageFlags.IsComponentsV2 });
    });

    it("bounds long predictions and shows escaped full choices separately", () => {
        const long = { ...card, predictions: Array(25).fill("*".repeat(80)), title: "*Showcase*" };
        const payload = bingoCardPayload(long);
        expect(JSON.stringify(payload)).toContain("...");
        const choices = bingoChoicesEmbed(long);
        expect(choices.length).toBeLessThanOrEqual(6000);
        expect(choices.toJSON().fields?.every(field => field.value.length <= 1024)).toBe(true);
        expect(choices.toJSON().fields?.[0].value).toContain("\\*");
        const emojiCard = { ...card, predictions: Array(25).fill(String.fromCodePoint(0x1f3ae).repeat(40)) };
        const rows = bingoCardPayload(emojiCard).components[0].toJSON().components.filter(component => component.type === ComponentType.ActionRow);
        const button = rows[0].components[0];
        expect("label" in button && button.label?.length).toBeLessThanOrEqual(80);
    });

    it("prefills single-square modals and accepts empty drafts and old row forms", () => {
        const modal = bingoEditModal(card, 24).toJSON();
        expect(modal.title).toBe("Prediction E5");
        expect(modal.custom_id).toBe("bingo:save:" + card.id + ":0:24:1");
        expect(modal.components).toHaveLength(1);
        expect(JSON.stringify(modal)).toContain('"value":"Announcement 25"');
        expect(bingoEditModal(card, 20, 5).toJSON().components).toHaveLength(5);
        expect(bingoEditModal({ ...card, predictions: Array(25).fill("") }, 0).toJSON()).toBeTruthy();
    });

    it("provides an owner-scoped saved-card picker with bounded pagination", () => {
        const cards = Array.from({ length: 25 }, (_, index) => ({ ...card, id: "card-" + index }));
        const picker = bingoCardPicker("123", { cards, page: 0, hasMore: true });
        const select = picker.components[0].toJSON().components[0];
        expect(select).toMatchObject({ custom_id: "bingo:open:123" });
        expect("options" in select && select.options).toHaveLength(25);
        expect(picker.components[1].toJSON().components).toMatchObject([
            { custom_id: "bingo:cards:123:0", disabled: true },
            { custom_id: "bingo:cards:123:1", disabled: false },
        ]);
        expect(bingoCardPicker("123", { cards: [], page: 0, hasMore: false }).content).toContain("/bingo name:");
    });
});
