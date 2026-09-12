import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction } from "discord.js";
import { handleBingoInteraction } from "../lib/bingoInteractions";
import { getBingoCard, updateBingoCard, type BingoView } from "../lib/bingo";
import { BingoError } from "../lib/bingoRules";

vi.mock("../lib/bingo", () => ({ getBingoCard: vi.fn(), updateBingoCard: vi.fn() }));

const view: BingoView = {
    event: { id: "00000000-0000-4000-8000-000000000001", guildId: "guild", createdById: "host", title: "Showcase", status: "open", createdAt: new Date() },
    card: {
        id: "00000000-0000-4000-8000-000000000002", eventId: "00000000-0000-4000-8000-000000000001",
        createdById: "owner", predictions: Array(25).fill(""), revision: 0, marks: 0, submittedAt: null, createdAt: new Date(),
    },
};

function interaction(action: string, userId = "owner", modal = false, fromMessage = false) {
    const fake = {
        customId: `bingo:${action}:${view.card.id}:0:0${modal ? ":1" : ""}`,
        guildId: "guild", user: { id: userId }, deferred: false, replied: false,
        isButton: () => !modal, isModalSubmit: () => modal, isFromMessage: () => fromMessage,
        fields: { getTextInputValue: vi.fn().mockReturnValue("New game announcement") },
        showModal: vi.fn(), reply: vi.fn(), followUp: vi.fn(), editReply: vi.fn(),
        deferUpdate: vi.fn(async () => { fake.deferred = true; }),
        deferReply: vi.fn(async () => { fake.deferred = true; }),
    };
    return fake;
}

type FakeInteraction = ReturnType<typeof interaction>;
const run = (fake: FakeInteraction) => handleBingoInteraction(fake as unknown as ButtonInteraction | ModalSubmitInteraction);

describe("bingo Discord interactions", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getBingoCard).mockResolvedValue(view);
        vi.mocked(updateBingoCard).mockResolvedValue(view);
    });

    it("refuses to open an editing modal for a spectator or event host", async () => {
        const fake = interaction("edit", "host");
        await run(fake);
        expect(fake.showModal).not.toHaveBeenCalled();
        expect(updateBingoCard).not.toHaveBeenCalled();
        expect(fake.reply).toHaveBeenCalledWith({ content: expect.stringContaining("Only the person who created"), flags: MessageFlags.Ephemeral });
    });

    it("opens the owner's edit modal with its current revision", async () => {
        const fake = interaction("edit");
        await run(fake);
        expect(fake.showModal).toHaveBeenCalledTimes(1);
        expect(fake.showModal.mock.calls[0][0].toJSON().custom_id).toBe(`bingo:save:${view.card.id}:0:0:1`);
    });

    it("uses the clicking user for marks and keeps authorization errors private", async () => {
        vi.mocked(updateBingoCard).mockRejectedValue(new BingoError("Only the person who created this card can mark it."));
        const fake = interaction("mark", "spectator");
        await run(fake);
        expect(updateBingoCard).toHaveBeenCalledWith(view.card.id, "guild", "spectator", { type: "mark", revision: 0, index: 0 });
        expect(fake.editReply).not.toHaveBeenCalled();
        expect(fake.followUp).toHaveBeenCalledWith({ content: expect.stringContaining("Only the person who created"), flags: MessageFlags.Ephemeral });
    });

    it("checks the actual submitting user again for forged or old modals", async () => {
        vi.mocked(updateBingoCard).mockRejectedValue(new BingoError("Only the person who created this card can edit it."));
        const fake = interaction("save", "spectator", true, true);
        await run(fake);
        expect(updateBingoCard).toHaveBeenCalledWith(view.card.id, "guild", "spectator", {
            type: "edit", revision: 0, start: 0, values: ["New game announcement"],
        });
        expect(fake.editReply).not.toHaveBeenCalled();
        expect(fake.followUp).toHaveBeenCalledTimes(1);
    });

    it("updates the originating card after a button modal and privately replies to slash modals", async () => {
        const buttonModal = interaction("save", "owner", true, true);
        await run(buttonModal);
        expect(buttonModal.deferUpdate).toHaveBeenCalledTimes(1);
        expect(buttonModal.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: "Predictions saved." }));
        const slashModal = interaction("save", "owner", true);
        await run(slashModal);
        expect(slashModal.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    });

    it("rejects malformed controls without writing", async () => {
        const fake = interaction("mark");
        fake.customId = `bingo:mark:${view.card.id}:0:25`;
        await run(fake);
        expect(updateBingoCard).not.toHaveBeenCalled();
        expect(fake.reply).toHaveBeenCalledWith({ content: expect.stringContaining("invalid"), flags: MessageFlags.Ephemeral });
    });
});
