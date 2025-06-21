import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import { config } from "../../constants/config";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import {responses} from "../../constants/commands/8ball";

export class EightBallCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "8ball",
            description: "Ask the magic 8-ball a question.",
            aliases: ["eightball", "8-ball", "magic8ball"]
        });
    }

    // Register the slash command
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('8ball')
                    .setDescription("Ask the magic 8-ball a question.")
                    .addStringOption((option) =>
                        option
                            .setName("question")
                            .setDescription("The question you want to ask")
                            .setRequired(true)
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

        const question = interaction.options.getString("question", true);
        const response = responses[Math.floor(Math.random() * responses.length)];
        const responseColor = this.getResponseColor(response);

        const embed = new EmbedBuilder()
            .setTitle("🎱 Magic 8-Ball")
            .addFields([
                {
                    name: "Question",
                    value: question,
                    inline: false
                },
                {
                    name: "Answer",
                    value: response,
                    inline: false
                }
            ])
            .setColor(responseColor)
            .setTimestamp()
            .setFooter({
                text: `Asked by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await interaction.reply({ embeds: [embed] });
    }

    private getResponseColor(response: string): number {
        const responseIndex = responses.indexOf(response);

        if (responseIndex < 10) return Colors.Green;  // Positive responses
        if (responseIndex < 15) return Colors.Yellow; // Neutral responses
        return Colors.Red; // Negative responses
    }
}