import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags, Message } from 'discord.js';
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class LeaderboardCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "leaderboard",
            description: "Show the XP leaderboard.",
            aliases: ["lb", "top"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('leaderboard')
                    .setDescription("Show the XP leaderboard."),
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

        if (!interaction.guild) {
            await interaction.reply({ content: "This command can only be used in a server.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const topUsers = await db
            .select()
            .from(users)
            .where(eq(users.guildId, interaction.guild.id))
            .orderBy(desc(users.xp))
            .limit(10);

        if (topUsers.length === 0) {
            await interaction.reply({
                content: "No one on the leaderboard yet!",
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const medals = ["🥇", "🥈", "🥉"];
        const description = topUsers
            .map((u, i) => {
                const icon = i < 3 ? medals[i] : `**${i + 1}.**`;
                return `${icon} <@${u.userId}> — Level **${u.level}** (${u.xp} XP)`;
            })
            .join("\n");

        const embed = new EmbedBuilder()
            .setTitle("XP Leaderboard")
            .setColor(Colors.Gold)
            .setDescription(description)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    public override async messageRun(message: Message, _args: any): Promise<void> {
        if (!message.guild) return;

        createCommandLog({
            command: this.name,
            guild: message.guild.name,
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        const topUsers = await db
            .select()
            .from(users)
            .where(eq(users.guildId, message.guild.id))
            .orderBy(desc(users.xp))
            .limit(10);

        if (topUsers.length === 0) {
            await message.reply("No one on the leaderboard yet!");
            return;
        }

        const medals = ["🥇", "🥈", "🥉"];
        const description = topUsers
            .map((u, i) => {
                const icon = i < 3 ? medals[i] : `**${i + 1}.**`;
                return `${icon} <@${u.userId}> — Level **${u.level}** (${u.xp} XP)`;
            })
            .join("\n");

        await message.reply(description);
    }
}
