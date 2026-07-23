import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message } from "discord.js";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class PingCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "ping",
            description: "Check the bot's latency.",
            aliases: ["pong"],
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName("ping")
                    .setDescription("Check the bot's latency."),
            {
                registerCommandIfMissing: true,
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const content = this.runCommand(
            interaction.user.username,
            interaction.user.tag,
            interaction.guild?.name ?? "DM",
            interaction.createdAt
        );

        await interaction.reply({ content });
    }

    public override async messageRun(message: Message, _args: unknown): Promise<void> {
        const latency = Math.round(this.container.client.ws.ping);
        await message.reply(`Pong! Latency: \`${latency}ms\``);
    }

    private runCommand(user: string, username: string, guild: string, createdAt: Date): string {
        createCommandLog({
            command: this.name,
            guild,
            type: CommandType.Slash,
            user: { username, displayName: user },
            createdAt,
        });

        const latency = Math.round(this.container.client.ws.ping);
        return `Pong! Latency: \`${latency}ms\``;
    }
}
