import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, Message } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

interface CommandInfo {
    name: string;
    description: string;
}

const COMMANDS: Record<string, CommandInfo[]> = {
    "General": [
        { name: "ping", description: "Check the bot's latency." },
        { name: "avatar", description: "Get a user's avatar." },
        { name: "server", description: "Display information about the server." },
        { name: "user", description: "Display information about a user." },
        { name: "help", description: "Show this help menu." },
    ],
    "Games": [
        { name: "8ball", description: "Ask the magic 8-ball a question." },
        { name: "coinflip", description: "Flip a virtual coin." },
        { name: "dice", description: "Roll one or more dice." },
        { name: "rps", description: "Play rock, paper, scissors." },
    ],
    "Jokes": [
        { name: "howgay", description: "Check how gay someone is (humor command)." },
    ],
    "Music": [
        { name: "play", description: "Play a song or playlist from YouTube/Spotify." },
        { name: "queue", description: "Display the current music queue." },
        { name: "skip", description: "Skip the current track." },
        { name: "stop", description: "Stop the music player and leave voice." },
        { name: "pause", description: "Pause the current track." },
        { name: "resume", description: "Resume the paused music." },
        { name: "volume", description: "Set or check the volume." },
        { name: "shuffle", description: "Shuffle the current queue." },
    ],
    "Moderation": [
        { name: "warn", description: "Warn a user." },
        { name: "warns", description: "View a user's active warnings." },
        { name: "delwarn", description: "Remove a warning from a user." },
        { name: "mute", description: "Timeout a user." },
        { name: "unmute", description: "Remove a user's timeout." },
        { name: "ban", description: "Ban a user." },
        { name: "kick", description: "Kick a user." },
        { name: "setlog", description: "Set the moderation log channel." },
    ],
    "Engagement": [
        { name: "level", description: "Check your level and XP." },
        { name: "leaderboard", description: "Show the XP leaderboard." },
        { name: "daily", description: "Claim your daily coins." },
        { name: "balance", description: "Check your coin balance." },
    ],
    "Integrations": [
        { name: "hltb", description: "Check game completion times from howlongtobeat.com." },
    ],
};

export class HelpCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "help",
            description: "Show all available commands.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('help')
                    .setDescription("Show all available commands.")
                    .addStringOption((option) =>
                        option.setName("category")
                            .setDescription("Filter by category")
                            .setRequired(false)
                            .addChoices(
                                ...Object.keys(COMMANDS).map(cat => ({ name: cat, value: cat }))
                            )
                    ),
            {
                registerCommandIfMissing: true,
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        createCommandLog({
            command: this.name,
            guild: interaction.guild?.name ?? "DM",
            type: CommandType.Slash,
            user: { username: interaction.user.username, displayName: interaction.user.displayName },
            createdAt: interaction.createdAt
        });

        const category = interaction.options.getString("category");

        const embed = new EmbedBuilder()
            .setTitle("Help")
            .setColor(Colors.DarkAqua)
            .setTimestamp()
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        if (category) {
            const cmds = COMMANDS[category];
            if (!cmds) {
                await interaction.reply({ content: "Unknown category.", flags: [MessageFlags.Ephemeral] });
                return;
            }
            embed.setDescription(cmds.map(c => `**$${c.name}** - ${c.description}`).join("\n"));
        } else {
            let total = "";
            for (const [cat, cmds] of Object.entries(COMMANDS)) {
                total += `**${cat}** (${cmds.length} commands)\n`;
            }
            embed.setDescription(
                total + "\nUse `$help <category>` to see commands for a specific category.\n" +
                "Prefix: `$`"
            );
        }

        await interaction.reply({ embeds: [embed] });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const rawCategory = await args.remainder('string').catch(() => null);
        const category = rawCategory ? rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1) : undefined;

        if (category && COMMANDS[category]) {
            const description = COMMANDS[category].map(c => `\`$${c.name}\` - ${c.description}`).join("\n");
            await message.reply(description);
        } else {
            let description = "";
            for (const [cat, cmds] of Object.entries(COMMANDS)) {
                description += `**${cat}** (${cmds.length} commands)\n`;
            }
            description += "\nUse `$help <category>` to see commands for a specific category.";
            await message.reply(description);
        }
    }
}
