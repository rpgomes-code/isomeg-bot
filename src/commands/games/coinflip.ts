import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, Message } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class CoinflipCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "coinflip",
            description: "Flip a virtual coin.",
            aliases: ["flip", "coin", "heads", "tails"]
        });
    }

    // Register the slash command
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('coinflip')
                    .setDescription("Flip a virtual coin.")
                    .addIntegerOption((option) =>
                        option
                            .setName("times")
                            .setDescription("Number of times to flip the coin (max 100)")
                            .setMinValue(1)
                            .setMaxValue(100)
                    ),
            {
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

        const times = interaction.options.getInteger("times") ?? 1;
        const results: string[] = [];
        let heads = 0;
        let tails = 0;

        // Flip the coin(s)
        for (let i = 0; i < times; i++) {
            const result = Math.random() < 0.5 ? "Heads" : "Tails";
            results.push(result);
            if (result === "Heads") heads++;
            else tails++;
        }

        const embed = new EmbedBuilder()
            .setTitle("🪙 Coin Flip")
            .setColor(Colors.Gold)
            .setTimestamp()
            .setFooter({
                text: `Flipped by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        if (times === 1) {
            // Single coin flip
            embed.setDescription(`The coin landed on: **${results[0]}**!`);
        } else {
            // Multiple coin flips with improved formatting
            let description = `Flipped ${times} coins...\n\n`;

            if (times <= 20) {
                // Show individual results with emojis for smaller amounts
                const formattedResults = results.map(result =>
                    result === "Heads" ? "🟡" : "⚪"
                ).join(" ");
                description += `**Results:** ${formattedResults}\n`;
                description += `🟡 = Heads | ⚪ = Tails\n\n`;
            } else {
                // For larger amounts, show a summary
                description += `*Too many results to display individually*\n\n`;
            }

            description += `**Summary:**\n`;
            description += `🟡 Heads: **${heads}** (${((heads / times) * 100).toFixed(1)}%)\n`;
            description += `⚪ Tails: **${tails}** (${((tails / times) * 100).toFixed(1)}%)`;

            embed.setDescription(description);
        }

        await interaction.reply({ embeds: [embed] });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        createCommandLog({
            command: this.name,
            guild: message.guild?.name ?? "DM",
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        const times = parseInt(await args.single('string').catch(() => null)) || 1;
        const results: string[] = [];
        let heads = 0;
        let tails = 0;
        for (let i = 0; i < Math.min(times, 100); i++) {
            const result = Math.random() < 0.5 ? "Heads" : "Tails";
            results.push(result);
            if (result === "Heads") heads++; else tails++;
        }
        if (times === 1) {
            await message.reply(`🪙 The coin landed on: **${results[0]}**!`);
        } else {
            await message.reply(`🪙 Flipped ${times} coins: ${heads} Heads, ${tails} Tails`);
        }
    }
}
