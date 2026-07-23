import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags, Message } from 'discord.js';
import { getUserData, calculateLevel, getUserRank } from "../../lib/xp";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class LevelCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "level",
            description: "Check your level and XP.",
            aliases: ["rank", "xp"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('level')
                    .setDescription("Check your level and XP.")
                    .addUserOption((option) =>
                        option.setName("user").setDescription("User to check").setRequired(false)
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

        if (!interaction.guild) {
            await interaction.reply({ content: "This command can only be used in a server.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const target = interaction.options.getUser("user") ?? interaction.user;
        const data = await getUserData(interaction.guild.id, target.id);

        if (!data) {
            await interaction.reply({
                content: `${target.tag} has no XP yet. Start chatting to earn XP!`,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const levelInfo = calculateLevel(data.xp);
        const rank = await getUserRank(interaction.guild.id, target.id, data.xp);
        const embed = this.createLevelEmbed(target.displayName, target.displayAvatarURL({ size: 256 }), data.xp, levelInfo, rank);

        await interaction.reply({ embeds: [embed] });
    }

    public override async messageRun(message: Message, _args: any): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        createCommandLog({
            command: this.name,
            guild: message.guild.name,
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        const target = message.mentions.users.first() ?? message.author;
        const data = await getUserData(message.guild.id, target.id);

        if (!data) {
            await message.reply(`${target.tag} has no XP yet. Start chatting to earn XP!`);
            return;
        }

        const levelInfo = calculateLevel(data.xp);
        const rank = await getUserRank(message.guild.id, target.id, data.xp);
        await message.reply({
            embeds: [this.createLevelEmbed(target.displayName, target.displayAvatarURL({ size: 256 }), data.xp, levelInfo, rank)],
        });
    }

    private getProgressBar(progress: number): string {
        const totalBars = 10;
        const filledBars = Math.round((progress / 100) * totalBars);
        return `[${"#".repeat(filledBars)}${"-".repeat(totalBars - filledBars)}]`;
    }

    private createLevelEmbed(
        displayName: string,
        avatarUrl: string,
        totalXp: number,
        levelInfo: ReturnType<typeof calculateLevel>,
        rank: number | null
    ): EmbedBuilder {
        const levelTotal = levelInfo.xpInLevel + levelInfo.xpToNext;
        const progress = totalXp > 0 ? (levelInfo.xpInLevel / levelTotal) * 100 : 0;

        return new EmbedBuilder()
            .setTitle(`Rank Card: ${displayName}`)
            .setColor(Colors.DarkAqua)
            .setThumbnail(avatarUrl)
            .addFields([
                { name: "Level", value: `**${levelInfo.level}**`, inline: true },
                { name: "Server Rank", value: rank ? `**#${rank}**` : "Unranked", inline: true },
                { name: "Total XP", value: `**${totalXp}**`, inline: true },
                { name: "Progress", value: `${this.getProgressBar(progress)} ${levelInfo.xpInLevel}/${levelTotal} XP`, inline: false },
                { name: "Next Level", value: `${levelInfo.xpToNext} XP to go`, inline: true },
            ])
            .setTimestamp();
    }
}
