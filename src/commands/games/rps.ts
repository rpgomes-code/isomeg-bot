import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { config } from "../../constants/config";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { RPSChoice } from "../../enums/commands/rps";
import {choices, emojis, winningCombos} from "../../constants/commands/rps";

export class RPSCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "rps",
            description: "Play rock, paper, scissors with the bot!",
            aliases: ["rockpaperscissors", "roshambo"]
        });
    }

    // Register the slash command
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('rps')
                    .setDescription("Play rock, paper, scissors with the bot!")
                    .addStringOption((option) =>
                        option
                            .setName("choice")
                            .setDescription("Choose your weapon!")
                            .setRequired(true)
                            .addChoices(
                                { name: "🪨 Rock", value: RPSChoice.Rock },
                                { name: "📄 Paper", value: RPSChoice.Paper },
                                { name: "✂️ Scissors", value: RPSChoice.Scissors }
                            )
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

        const userChoice = interaction.options.getString("choice") as RPSChoice;
        const botChoice = this.getRandomChoice();

        let result: string;
        let color: number;

        // Determine a winner and set color
        if (userChoice === botChoice) {
            result = "It's a tie!";
            color = Colors.Yellow;
        } else if (winningCombos[userChoice] === botChoice) {
            result = "You win!";
            color = Colors.Green;
        } else {
            result = "I win!";
            color = Colors.Red;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle("🎮 Rock Paper Scissors")
            .addFields([
                {
                    name: "Your Choice",
                    value: `${emojis[userChoice]} ${this.capitalizeFirst(userChoice)}`,
                    inline: true,
                },
                {
                    name: "My Choice",
                    value: `${emojis[botChoice]} ${this.capitalizeFirst(botChoice)}`,
                    inline: true,
                },
                {
                    name: "Result",
                    value: result,
                    inline: false,
                }
            ])
            .setTimestamp()
            .setFooter({
                text: `Played by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await interaction.reply({ embeds: [embed] });
    }

    private getRandomChoice(): RPSChoice {
        return choices[Math.floor(Math.random() * choices.length)];
    }

    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}