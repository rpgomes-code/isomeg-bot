import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message, MessageFlags, PermissionFlagsBits, type Guild } from "discord.js";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { closePoll, createPoll, createPollComponents, createPollEmbed, getPoll, normalizePollOptions, parsePrefixPollInput, setPollMessageId } from "../../lib/polls";
import { ensureGuildSettings } from "../../lib/guildSettings";
import { hasModeratorPermission } from "../../lib/moderation";

export class PollCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "poll",
            description: "Create or close anonymous polls.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName("poll")
                .setDescription("Create or close anonymous polls.")
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("create")
                        .setDescription("Create a poll with up to five options.")
                        .addStringOption((option) => option.setName("question").setDescription("Poll question.").setRequired(true))
                        .addStringOption((option) => option.setName("option1").setDescription("First option.").setRequired(true))
                        .addStringOption((option) => option.setName("option2").setDescription("Second option.").setRequired(true))
                        .addStringOption((option) => option.setName("option3").setDescription("Third option.").setRequired(false))
                        .addStringOption((option) => option.setName("option4").setDescription("Fourth option.").setRequired(false))
                        .addStringOption((option) => option.setName("option5").setDescription("Fifth option.").setRequired(false))
                        .addIntegerOption((option) =>
                            option
                                .setName("duration-hours")
                                .setDescription("Optional poll duration in hours.")
                                .setRequired(false)
                                .setMinValue(1)
                                .setMaxValue(168)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("close")
                        .setDescription("Close a poll by ID.")
                        .addStringOption((option) => option.setName("poll-id").setDescription("Poll ID from the embed footer.").setRequired(true))
                ),
            { registerCommandIfMissing: true }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        createCommandLog({
            command: this.name,
            guild: interaction.guild?.name ?? "DM",
            type: CommandType.Slash,
            user: { username: interaction.user.username, displayName: interaction.user.displayName },
            createdAt: interaction.createdAt,
        });

        if (!interaction.guild || !interaction.channel?.isTextBased()) {
            await interaction.reply({ content: "This command can only be used in a server text channel.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        await ensureGuildSettings(interaction.guild.id, interaction.guild.name);

        if (subcommand === "close") {
            const pollId = interaction.options.getString("poll-id", true);
            const existingPoll = await getPoll(pollId);
            if (!existingPoll || existingPoll.guildId !== interaction.guild.id) {
                await interaction.reply({ content: "No poll found with that ID.", flags: [MessageFlags.Ephemeral] });
                return;
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (existingPoll.createdById !== interaction.user.id && !hasModeratorPermission(member, PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({ content: "Only the poll creator or a server manager can close this poll.", flags: [MessageFlags.Ephemeral] });
                return;
            }

            const poll = await closePoll(pollId, interaction.guild.id);
            if (!poll) {
                await interaction.reply({ content: "No poll found with that ID.", flags: [MessageFlags.Ephemeral] });
                return;
            }

            await interaction.reply({ content: `Poll \`${poll.id}\` is now closed.`, flags: [MessageFlags.Ephemeral] });
            await this.refreshPollMessage(interaction.guild, poll);
            return;
        }

        const options = normalizePollOptions([
            interaction.options.getString("option1", true),
            interaction.options.getString("option2", true),
            interaction.options.getString("option3") ?? "",
            interaction.options.getString("option4") ?? "",
            interaction.options.getString("option5") ?? "",
        ]);

        if (options.length < 2) {
            await interaction.reply({ content: "A poll needs at least two unique options.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const durationHours = interaction.options.getInteger("duration-hours");
        const expiresAt = durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000) : null;
        const poll = await createPoll({
            guildId: interaction.guild.id,
            channelId: interaction.channelId,
            createdById: interaction.user.id,
            question: interaction.options.getString("question", true).slice(0, 256),
            options,
            anonymous: true,
            expiresAt,
        });

        const pollMessage = await interaction.channel.send({
            embeds: [await createPollEmbed(poll)],
            components: createPollComponents(poll),
        });
        await setPollMessageId(poll.id, pollMessage.id);

        await interaction.reply({ content: `Poll created. ID: \`${poll.id}\``, flags: [MessageFlags.Ephemeral] });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        if (!message.guild || !message.channel.isTextBased() || !("send" in message.channel)) {
            await message.reply("This command can only be used in a server text channel.");
            return;
        }

        const input = await args.rest("string").catch(() => null);
        if (!input) {
            await message.reply("Usage: `$poll Question | Option A | Option B | Option C`");
            return;
        }

        if (input.toLowerCase().startsWith("close ")) {
            const pollId = input.slice("close ".length).trim();
            const existingPoll = await getPoll(pollId);
            if (!existingPoll || existingPoll.guildId !== message.guild.id) {
                await message.reply("No poll found with that ID.");
                return;
            }

            const member = await message.guild.members.fetch(message.author.id);
            if (existingPoll.createdById !== message.author.id && !hasModeratorPermission(member, PermissionFlagsBits.ManageGuild)) {
                await message.reply("Only the poll creator or a server manager can close this poll.");
                return;
            }

            const poll = await closePoll(pollId, message.guild.id);
            await message.reply(poll ? `Poll \`${poll.id}\` is now closed.` : "No poll found with that ID.");
            await this.refreshPollMessage(message.guild, poll);
            return;
        }

        const parsed = parsePrefixPollInput(input);
        if (!parsed || parsed.options.length < 2) {
            await message.reply("Usage: `$poll Question | Option A | Option B | Option C`");
            return;
        }

        createCommandLog({
            command: this.name,
            guild: message.guild.name,
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username },
            createdAt: message.createdAt,
        });

        await ensureGuildSettings(message.guild.id, message.guild.name);

        const poll = await createPoll({
            guildId: message.guild.id,
            channelId: message.channelId,
            createdById: message.author.id,
            question: parsed.question.slice(0, 256),
            options: parsed.options,
            anonymous: true,
        });

        const pollMessage = await message.channel.send({
            embeds: [await createPollEmbed(poll)],
            components: createPollComponents(poll),
        });
        await setPollMessageId(poll.id, pollMessage.id);
        await message.reply(`Poll created. ID: \`${poll.id}\``);
    }

    private async refreshPollMessage(guild: Guild, poll: Awaited<ReturnType<typeof closePoll>>): Promise<void> {
        if (!poll?.messageId) return;

        const channel = await guild.channels.fetch(poll.channelId).catch(() => null);
        if (!channel?.isTextBased() || !("messages" in channel)) return;

        const message = await channel.messages.fetch(poll.messageId).catch(() => null);
        if (!message) return;

        await message.edit({
            embeds: [await createPollEmbed(poll)],
            components: createPollComponents(poll),
        }).catch(() => null);
    }
}
