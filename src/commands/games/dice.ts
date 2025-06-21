import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { config } from "../../constants/config";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class DiceCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "dice",
            description: "Roll one or more dice.",
            aliases: ["roll", "d6", "d20"]
        });
    }

    // Register the slash command
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('dice')
                    .setDescription("Roll one or more dice.")
                    .addIntegerOption((option) =>
                        option
                            .setName("sides")
                            .setDescription("Number of sides on the dice (default: 6)")
                            .setMinValue(2)
                            .setMaxValue(100)
                    )
                    .addIntegerOption((option) =>
                        option
                            .setName("count")
                            .setDescription("Number of dice to roll (default: 1)")
                            .setMinValue(1)
                            .setMaxValue(5)
                    )
                    .addBooleanOption((option) =>
                        option
                            .setName("sum")
                            .setDescription("Show the sum of all dice (default: false)")
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

        const sides = interaction.options.getInteger("sides") ?? 6;
        const count = interaction.options.getInteger("count") ?? 1;
        const showSum = interaction.options.getBoolean("sum") ?? false;

        const rolls: number[] = [];
        let total = 0;

        // Roll the dice
        for (let i = 0; i < count; i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            rolls.push(roll);
            total += roll;
        }

        const embed = new EmbedBuilder()
            .setTitle("🎲 Dice Roll")
            .setColor(Colors.DarkGold)
            .setTimestamp()
            .setFooter({
                text: `Rolled by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        if (count === 1) {
            embed.setDescription(`You rolled a **${rolls[0]}**!`);
        } else {
            let description = `Rolling ${count} d${sides}...\n\n`;
            description += `Results: ${rolls.join(", ")}`;

            if (showSum) {
                description += `\n\nTotal: **${total}**`;
                const average = (total / count).toFixed(2);
                description += `\nAverage: **${average}**`;
            }
            embed.setDescription(description);
        }

        // Add flavor text for special rolls
        if (count > 1) {
            const highest = Math.max(...rolls);
            const lowest = Math.min(...rolls);

            if (highest === sides) {
                embed.addFields({
                    name: "🌟 Critical Success!",
                    value: `You rolled the highest possible number (${sides})!`,
                    inline: false
                });
            }

            if (lowest === 1) {
                embed.addFields({
                    name: "💫 Critical Fail!",
                    value: "You rolled the lowest possible number (1)!",
                    inline: false
                });
            }
        }

        await interaction.reply({ embeds: [embed] });
    }
}