import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterBehavior, type ApplicationCommandRegistry } from "@sapphire/framework";
import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { BingoCommand } from "../commands/games/bingo";
import { createBingoCard, listBingoCards } from "../lib/bingo";
import { ensureGuildSettings } from "../lib/guildSettings";

vi.mock("../lib/bingo", () => ({ createBingoCard: vi.fn(), listBingoCards: vi.fn() }));
vi.mock("../lib/guildSettings", () => ({ ensureGuildSettings: vi.fn() }));

function interaction(name: string | null) {
    return {
        guild: { id: "guild", name: "Test guild" }, user: { id: "123" },
        options: { getString: vi.fn().mockReturnValue(name) },
        reply: vi.fn(), deferReply: vi.fn(), editReply: vi.fn(),
    };
}

describe("bingo command", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(createBingoCard).mockResolvedValue({
            id: "00000000-0000-4000-8000-000000000001", eventId: null, guildId: "guild", title: "Showcase",
            createdById: "123", predictions: Array(25).fill(""), marks: 0, revision: 0, submittedAt: null, createdAt: new Date(),
        });
        vi.mocked(listBingoCards).mockResolvedValue({ cards: [], page: 0, hasMore: false });
    });

    it("registers one optional card-name input and replaces the previous event subcommands", () => {
        const registerChatInputCommand = vi.fn();
        BingoCommand.prototype.registerApplicationCommands.call({ description: "Bingo cards" } as BingoCommand,
            { registerChatInputCommand } as unknown as ApplicationCommandRegistry);
        const [configure, options] = registerChatInputCommand.mock.calls[0];
        const command = configure(new SlashCommandBuilder()).toJSON();
        expect(command.name).toBe("bingo");
        expect(command.options).toHaveLength(1);
        expect(command.options[0]).toMatchObject({ name: "name", type: 3, max_length: 100 });
        expect(command.options[0].required).toBeFalsy();
        expect(options.behaviorWhenNotIdentical).toBe(RegisterBehavior.Overwrite);
    });

    it("creates a named, public card from a single slash command", async () => {
        const fake = interaction("Showcase");
        await BingoCommand.prototype.chatInputRun(fake as unknown as ChatInputCommandInteraction);
        expect(ensureGuildSettings).toHaveBeenCalledWith("guild", "Test guild");
        expect(createBingoCard).toHaveBeenCalledWith("guild", "123", "Showcase");
        expect(fake.deferReply).toHaveBeenCalledWith({});
        expect(fake.editReply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.IsComponentsV2 }));
        expect(JSON.stringify(fake.editReply.mock.calls[0][0])).toContain("Confirm Choices");
    });

    it("opens the owner's saved cards privately when no name is provided", async () => {
        const fake = interaction(null);
        await BingoCommand.prototype.chatInputRun(fake as unknown as ChatInputCommandInteraction);
        expect(fake.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(createBingoCard).not.toHaveBeenCalled();
        expect(listBingoCards).toHaveBeenCalledWith("guild", "123");
        expect(fake.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("No saved cards") }));
    });

    it("answers DMs without creating a card", async () => {
        const fake = { ...interaction("Showcase"), guild: null };
        await BingoCommand.prototype.chatInputRun(fake as unknown as ChatInputCommandInteraction);
        expect(fake.reply).toHaveBeenCalledWith({ content: expect.stringContaining("server"), flags: MessageFlags.Ephemeral });
        expect(createBingoCard).not.toHaveBeenCalled();
    });
});
