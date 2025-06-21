import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { ApplicationCommandRegistry } from '@sapphire/framework';
import {config} from "../lib/config";

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
        const startTime = Date.now();

        await interaction.reply({
            content: 'Pinging...',
            flags: [
                MessageFlags.Ephemeral
            ]
        });

        const endTime = Date.now();
        const apiLatency = Math.abs(endTime - startTime);

        const content = `Pong! Bot Latency: ${Math.abs(Math.round(this.container.client.ws.ping))}ms. API Latency: ${apiLatency}ms.`;

        await interaction.editReply({ content });
    }
}