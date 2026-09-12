import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction, type StringSelectMenuInteraction } from "discord.js";
import { handleBingoInteraction } from "../lib/bingoInteractions";
import { getBingoCard, listBingoCards, updateBingoCard } from "../lib/bingo";
import { BingoError, BingoStaleCardError } from "../lib/bingoRules";
import type { BingoCard } from "../db/schema";

vi.mock("../lib/bingo", () => ({ getBingoCard: vi.fn(), listBingoCards: vi.fn(), updateBingoCard: vi.fn() }));

const card: BingoCard = {
    id: "00000000-0000-4000-8000-000000000002", eventId: null, guildId: "guild", title: "Showcase",
    createdById: "123", predictions: Array(25).fill(""), revision: 0, marks: 0, submittedAt: null, createdAt: new Date(),
};

function interaction(action: string, options: { userId?: string; modal?: boolean; fromMessage?: boolean; select?: boolean } = {}) {
    const modal = options.modal ?? false;
    const fake = {
        customId: "bingo:" + action + ":" + card.id + ":0" + (["square", "edit", "mark", "save"].includes(action) ? ":0" : "") + (modal ? ":1" : ""),
        guildId: "guild", user: { id: options.userId ?? "123" }, deferred: false, replied: false,
        isButton: () => !modal && !options.select, isModalSubmit: () => modal,
        isStringSelectMenu: () => Boolean(options.select), isFromMessage: () => options.fromMessage ?? true,
        fields: { getTextInputValue: vi.fn().mockReturnValue("New game announcement") }, values: [card.id],
        showModal: vi.fn(), followUp: vi.fn(), editReply: vi.fn(),
        reply: vi.fn(async (_payload: unknown) => { fake.replied = true; }),
        update: vi.fn(async (_payload: unknown) => { fake.replied = true; }),
        deferUpdate: vi.fn(async () => { fake.deferred = true; }),
        deferReply: vi.fn(async (_payload: unknown) => { fake.deferred = true; }),
    };
    return fake;
}

type FakeInteraction = ReturnType<typeof interaction>;
const run = (fake: FakeInteraction) => handleBingoInteraction(fake as unknown as ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction);

describe("bingo Discord interactions", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getBingoCard).mockResolvedValue(card);
        vi.mocked(updateBingoCard).mockResolvedValue(card);
        vi.mocked(listBingoCards).mockResolvedValue({ cards: [card], page: 0, hasMore: false });
    });

    it("opens a text modal when the owner clicks a draft square", async () => {
        const fake = interaction("square");
        await run(fake);
        expect(fake.showModal.mock.calls[0][0].toJSON()).toMatchObject({
            custom_id: "bingo:save:" + card.id + ":0:0:1", title: "Prediction A1",
        });
        expect(updateBingoCard).not.toHaveBeenCalled();
    });

    it.each(["square", "mark", "edit"])("refuses spectator %s clicks", async action => {
        const fake = interaction(action, { userId: "456" });
        await run(fake);
        expect(fake.showModal).not.toHaveBeenCalled();
        expect(updateBingoCard).not.toHaveBeenCalled();
        expect(fake.reply).toHaveBeenCalledWith({ content: expect.stringContaining("Only the person who created"), flags: MessageFlags.Ephemeral });
    });

    it("saves the modal to the originating card, without posting another card", async () => {
        const fake = interaction("save", { modal: true });
        await run(fake);
        expect(updateBingoCard).toHaveBeenCalledWith(card.id, "guild", "123", {
            type: "edit", revision: 0, start: 0, values: ["New game announcement"],
        });
        expect(fake.deferUpdate).toHaveBeenCalledOnce();
        expect(fake.editReply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.IsComponentsV2, content: null, embeds: [] }));
        expect(fake.followUp).not.toHaveBeenCalled();
        expect(fake.reply).not.toHaveBeenCalled();
    });

    it("checks the actual submitting user again for forged modals", async () => {
        vi.mocked(updateBingoCard).mockRejectedValue(new BingoError("Only the person who created this card can edit it."));
        const fake = interaction("save", { userId: "456", modal: true });
        await run(fake);
        expect(updateBingoCard).toHaveBeenCalledWith(card.id, "guild", "456", expect.objectContaining({ type: "edit" }));
        expect(fake.editReply).not.toHaveBeenCalled();
        expect(fake.followUp).toHaveBeenCalledWith({ content: expect.stringContaining("Only the person"), flags: MessageFlags.Ephemeral });
    });

    it("confirms choices and replaces the same card with marking controls", async () => {
        vi.mocked(updateBingoCard).mockResolvedValue({ ...card, submittedAt: new Date(), revision: 1 });
        const fake = interaction("confirm");
        await run(fake);
        expect(updateBingoCard).toHaveBeenCalledWith(card.id, "guild", "123", { type: "confirm", revision: 0 });
        const rendered = JSON.stringify(fake.editReply.mock.calls[0][0]);
        expect(rendered).toContain('"label":"Check"');
        expect(rendered).toContain("Choices locked");
        expect(rendered).not.toContain("Confirm Choices");
    });

    it("keeps denied confirmation private without replacing the public card", async () => {
        vi.mocked(updateBingoCard).mockRejectedValue(new BingoError("Only the person who created this card can confirm it."));
        const fake = interaction("confirm", { userId: "456" });
        await run(fake);
        expect(updateBingoCard).toHaveBeenCalledWith(card.id, "guild", "456", { type: "confirm", revision: 0 });
        expect(fake.editReply).not.toHaveBeenCalled();
        expect(fake.followUp).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
    });

    it("immediately marks a locked square instead of opening an edit form", async () => {
        vi.mocked(getBingoCard).mockResolvedValue({ ...card, submittedAt: new Date() });
        vi.mocked(updateBingoCard).mockResolvedValue({ ...card, submittedAt: new Date(), marks: 1, revision: 1 });
        const fake = interaction("square");
        await run(fake);
        expect(fake.showModal).not.toHaveBeenCalled();
        expect(updateBingoCard).toHaveBeenCalledWith(card.id, "guild", "123", { type: "mark", revision: 0, index: 0 });
        expect(JSON.stringify(fake.editReply.mock.calls[0][0])).toContain("A1 [X]");
    });

    it("refreshes stale clicks on the same message without applying the old action", async () => {
        vi.mocked(getBingoCard).mockResolvedValue({ ...card, revision: 1 });
        const fake = interaction("square");
        await run(fake);
        expect(fake.update).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.IsComponentsV2 }));
        expect(updateBingoCard).not.toHaveBeenCalled();
        expect(fake.showModal).not.toHaveBeenCalled();
        expect(fake.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("refreshed") }));
    });

    it("refreshes stale forms without overwriting newer predictions", async () => {
        vi.mocked(updateBingoCard).mockRejectedValue(new BingoStaleCardError("This card has changed."));
        vi.mocked(getBingoCard).mockResolvedValue({ ...card, revision: 4, predictions: Array(25).fill("Latest choice") });
        const fake = interaction("save", { modal: true });
        await run(fake);
        expect(JSON.stringify(fake.editReply.mock.calls[0][0])).toContain("Latest choice");
        expect(fake.followUp).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }));
    });

    it("checks completed lines without changing marks", async () => {
        vi.mocked(getBingoCard).mockResolvedValue({ ...card, submittedAt: new Date(), marks: 31 });
        const fake = interaction("check");
        await run(fake);
        expect(updateBingoCard).not.toHaveBeenCalled();
        expect(fake.followUp).toHaveBeenCalledWith({
            content: expect.stringContaining("BINGO!** Row 1"), flags: MessageFlags.Ephemeral,
        });
    });

    it("lets spectators read full predictions privately", async () => {
        const fake = interaction("choices", { userId: "456" });
        await run(fake);
        expect(fake.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(fake.editReply.mock.calls[0][0].embeds[0].toJSON().fields).toHaveLength(5);
        expect(updateBingoCard).not.toHaveBeenCalled();
    });

    it("finishes the private choices reply when loading a deleted card fails", async () => {
        vi.mocked(getBingoCard).mockRejectedValue(new BingoError("This card no longer exists."));
        const fake = interaction("choices");
        await run(fake);
        expect(fake.editReply).toHaveBeenCalledWith({ content: "This card no longer exists." });
        expect(fake.followUp).not.toHaveBeenCalled();
    });

    it("opens a saved card from its owner's picker", async () => {
        const fake = interaction("open", { select: true });
        fake.customId = "bingo:open:123";
        await run(fake);
        expect(getBingoCard).toHaveBeenCalledWith(card.id, "guild");
        expect(fake.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: null, embeds: [], flags: MessageFlags.IsComponentsV2 }));
    });

    it("refuses another person's picker and forged selection values", async () => {
        const fake = interaction("open", { select: true, userId: "456" });
        fake.customId = "bingo:open:123";
        await run(fake);
        expect(getBingoCard).not.toHaveBeenCalled();
        expect(fake.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("someone else") }));

        const forged = interaction("open", { select: true });
        forged.customId = "bingo:open:123";
        vi.mocked(getBingoCard).mockResolvedValue({ ...card, createdById: "456" });
        await run(forged);
        expect(forged.editReply).not.toHaveBeenCalled();
        expect(forged.followUp).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("Only the person") }));
    });

    it("paginates only the requesting user's saved cards", async () => {
        const fake = interaction("cards");
        fake.customId = "bingo:cards:123:1";
        await run(fake);
        expect(listBingoCards).toHaveBeenCalledWith("guild", "123", 1);
        expect(fake.editReply).toHaveBeenCalledOnce();
    });

    it.each(["square:0:25", "confirm:0:0", "unlock:0", "save:0:24:5"])("rejects invalid control %s without writing", async suffix => {
        const [action, ...parts] = suffix.split(":");
        const fake = interaction(action, { modal: action === "save" });
        fake.customId = "bingo:" + action + ":" + card.id + ":" + parts.join(":");
        await run(fake);
        expect(updateBingoCard).not.toHaveBeenCalled();
        expect(fake.reply.mock.calls.length + fake.followUp.mock.calls.length).toBe(1);
    });
});
