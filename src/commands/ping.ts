import type {ApplicationCommandRegistry} from '@sapphire/framework';
import {Command} from '@sapphire/framework';
import {ChatInputCommandInteraction, MessageFlags} from 'discord.js';
import {config} from "../constants/config";
import {createCommandLog} from "../lib/logger";
import {CommandType} from "../enums/commands/general";

export class PingCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "ping",
            description: "Check the bot's latency.",
            aliases: ["pong"]
        });
    }

    // Register the slash command
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('ping')
                    .setDescription("Check the bot's latency."),
            {
                guildIds: [...config.guilds.map(guild => guild.id)],
                registerCommandIfMissing: true,
            }
        );
    }

    // Handle slash command
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        createCommandLog({
            command: Command.name,
            guild: interaction.guild?.name ?? "DM",
            type: CommandType.Slash,
            user: {
                username: interaction.user.username,
                displayName: interaction.user.tag
            },
            createdAt: interaction.createdAt
        })

        const startTime = Date.now();

        await interaction.reply({
            content: '🔄 *Pinging...*',
            flags: [
                MessageFlags.Ephemeral
            ]
        });

        const endTime = Date.now();
        const apiLatency = Math.abs(endTime - startTime);

        const content = `🏓 **Pong!**\n**Latency:** \`${Math.abs(Math.round(this.container.client.ws.ping))}ms\`\n**API Latency:** \`${apiLatency}ms\``;

        await interaction.editReply({ content });
    }
}