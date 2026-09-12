import { Command, type ApplicationCommandRegistry } from "@sapphire/framework";
import { ChatInputCommandInteraction, EmbedBuilder, escapeMarkdown, Message, MessageFlags } from "discord.js";
import { changeBingoEvent, createBingoEvent, getBingoCard, getBingoResults, joinBingoEvent, listBingoEvents, updateBingoCard } from "../../lib/bingo";
import { bingoCardPayload, bingoEditModal, bingoEventEmbed, bingoResultsEmbed } from "../../lib/bingoPresentation";
import { assertCardEditable, assertCardOwner, BingoError } from "../../lib/bingoRules";
import { ensureGuildSettings } from "../../lib/guildSettings";

export class BingoCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, { ...options, name: "bingo", description: "Event prediction cards, live bingo, and results." });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(builder => {
            builder.setName("bingo").setDescription(this.description)
                .addSubcommand(sub => sub.setName("create").setDescription("Create an event for prediction bingo.")
                    .addStringOption(opt => opt.setName("title").setDescription("Event name.").setRequired(true).setMaxLength(100)))
                .addSubcommand(sub => sub.setName("events").setDescription("List recent bingo events in this server."));
            for (const [name, description] of [
                ["join", "Create or reopen your card for an event."],
                ["start", "Start your event and lock predictions and submissions."],
                ["end", "End your event and freeze all marks."],
                ["results", "Show submitted cards and completed bingo lines."],
            ]) {
                builder.addSubcommand(sub => {
                    sub.setName(name).setDescription(description)
                        .addStringOption(opt => opt.setName("event-id").setDescription("Event ID.").setRequired(true));
                    if (name === "results") sub.addIntegerOption(opt => opt.setName("page").setDescription("Results page.").setMinValue(1));
                    return sub;
                });
            }
            for (const [name, description] of [
                ["card", "View a bingo card."],
                ["edit", "Edit a row of predictions on your draft card."],
                ["submit", "Submit and lock your completed prediction card."],
                ["unlock", "Unlock your submitted card before the event starts."],
            ]) {
                builder.addSubcommand(sub => {
                    sub.setName(name).setDescription(description)
                        .addStringOption(opt => opt.setName("card-id").setDescription("Card ID.").setRequired(true));
                    if (name === "edit") sub.addIntegerOption(opt => opt.setName("row").setDescription("Row to edit (1-5).")
                        .setRequired(true).setMinValue(1).setMaxValue(5));
                    if (name === "card") sub.addBooleanOption(opt => opt.setName("public").setDescription("Show this card to the channel."));
                    return sub;
                });
            }
            return builder;
        }, { registerCommandIfMissing: true });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guild) {
            await interaction.reply({ content: "Bingo can only be used in a server.", flags: MessageFlags.Ephemeral });
            return;
        }
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const action = interaction.options.getSubcommand();
        try {
            // A modal must be the initial response, so this branch cannot defer first.
            if (action === "edit") {
                const { event, card } = await getBingoCard(interaction.options.getString("card-id", true), guildId);
                assertCardOwner(card, userId);
                assertCardEditable(event, card);
                const start = (interaction.options.getInteger("row", true) - 1) * 5;
                await interaction.showModal(bingoEditModal(card, start, 5));
                return;
            }
            const publicCard = action === "card" && interaction.options.getBoolean("public") === true;
            await interaction.deferReply(publicCard ? {} : { flags: MessageFlags.Ephemeral });
            if (action === "create") {
                await ensureGuildSettings(guildId, interaction.guild.name);
                const event = await createBingoEvent(guildId, userId, interaction.options.getString("title", true));
                await interaction.editReply({
                    content: `Event created. Players can use \`/bingo join event-id:${event.id}\`.`,
                    embeds: [bingoEventEmbed(event)], allowedMentions: { parse: [] },
                });
            } else if (action === "events") {
                const events = await listBingoEvents(guildId);
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("Bingo events").setDescription(
                    events.map(event => `**${escapeMarkdown(event.title)}** (${event.status})\n\`${event.id}\``).join("\n\n") || "No bingo events yet.",
                )], allowedMentions: { parse: [] } });
            } else if (action === "join") {
                const view = await joinBingoEvent(interaction.options.getString("event-id", true), guildId, userId);
                await interaction.editReply({
                    content: "Your card. Edit a square or use /bingo edit for a whole row; /bingo submit locks your predictions.",
                    ...bingoCardPayload(view),
                });
            } else if (action === "card") {
                const view = await getBingoCard(interaction.options.getString("card-id", true), guildId);
                await interaction.editReply(bingoCardPayload(view));
            } else if (action === "submit" || action === "unlock") {
                const view = await updateBingoCard(interaction.options.getString("card-id", true), guildId, userId, { type: action });
                await interaction.editReply({
                    content: action === "submit" ? "Card submitted. Your predictions are locked." : "Card unlocked. Submit it again before the event starts.",
                    ...bingoCardPayload(view),
                });
            } else if (action === "start" || action === "end") {
                const event = await changeBingoEvent(interaction.options.getString("event-id", true), guildId, userId, action === "start" ? "live" : "ended");
                await interaction.editReply({
                    content: action === "start" ? "Event started. Open /bingo card to mark squares as predictions happen. Marks save immediately." : "Event ended. Cards are frozen; /bingo results shows the final standings.",
                    embeds: [bingoEventEmbed(event)], allowedMentions: { parse: [] },
                });
            } else if (action === "results") {
                const { event, cards } = await getBingoResults(interaction.options.getString("event-id", true), guildId);
                await interaction.editReply({
                    embeds: [bingoResultsEmbed(event, cards, interaction.options.getInteger("page") ?? 1)], allowedMentions: { parse: [] },
                });
            }
        } catch (error) {
            if (!(error instanceof BingoError)) throw error;
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: error.message });
            else await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral });
        }
    }

    public override async messageRun(message: Message): Promise<void> {
        await message.reply("Use /bingo create or /bingo events to find an event. Cards are managed through /bingo and their buttons.");
    }
}
