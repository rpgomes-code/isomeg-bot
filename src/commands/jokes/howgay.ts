import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, User, MessageFlags } from 'discord.js';
import { config } from "../../constants/config";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { RarityLevel } from "../../types/commands/howgay";
import { rarityLevels } from "../../constants/commands/howgay";

export class HowGayCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "howgay",
            description: "Check how gay someone is (humor command).",
            aliases: ["gaymeter", "gayness"]
        });
    }

    // Register the slash command
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('howgay')
                    .setDescription("Check how gay someone is (humor command).")
                    .addUserOption((option) =>
                        option
                            .setName("target")
                            .setDescription("The user to check")
                            .setRequired(false)
                    ),
            {
                guildIds: [...config.guilds.map(guild => guild.id)],
                registerCommandIfMissing: true,
            }
        );
    }

    // Handle slash command
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        createCommandLog({
            command: this.name,
            guild: interaction.guild?.name ?? "DM",
            type: CommandType.Slash,
            user: {
                username: interaction.user.username,
                displayName: interaction.user.displayName
            },
            createdAt: interaction.createdAt
        });

        const target: User = interaction.options.getUser("target") ?? interaction.user;
        const percentage = this.generateRandomPercentage();
        const rarity = this.getRarityLevel(percentage);

        const embed = new EmbedBuilder()
            .setColor(rarity.color)
            .setTitle(`${rarity.emoji} Gay Rating Machine ${rarity.emoji}`)
            .setDescription(`Calculating gayness for ${target}...`)
            .addFields([
                {
                    name: "Result",
                    value: `${target} is ${percentage}% Gay 🏳️‍🌈`,
                    inline: false,
                },
                {
                    name: "Rarity",
                    value: `${rarity.emoji} ${rarity.label}`,
                    inline: true,
                },
                {
                    name: "Progress",
                    value: `${this.getProgressBar(percentage)} ${Math.abs(percentage)}%`,
                    inline: false,
                },
            ])
            .setTimestamp()
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        // Add the user's avatar as a thumbnail
        embed.setThumbnail(target.displayAvatarURL({ size: 256 }));

        await interaction.reply({
            embeds: [embed]
        });
    }

    private getRarityLevel(percentage: number): RarityLevel {
        if (percentage < 0) return rarityLevels.find(r => r.id === "impossible")!;
        if (percentage <= 30) return rarityLevels.find(r => r.id === "rare")!;
        if (percentage <= 60) return rarityLevels.find(r => r.id === "uncommon")!;
        if (percentage <= 99) return rarityLevels.find(r => r.id === "very_rare")!;
        return rarityLevels.find(r => r.id === "extra_rare")!;
    }

    private generateRandomPercentage(): number {
        // 0.1% chance for negative value (-1000%)
        if (Math.random() < 0.001) return -1000;

        // 0.5% chance for exactly 100%
        if (Math.random() < 0.005) return 100;

        // Otherwise, generate a number between 0 and 99
        return Math.floor(Math.random() * 100);
    }

    private getProgressBar(percentage: number): string {
        const totalBars = 10;
        const filledBars = Math.round((Math.abs(percentage) / 100) * totalBars);
        const emptyBars = totalBars - filledBars;

        return "█".repeat(filledBars) + "░".repeat(emptyBars);
    }
}