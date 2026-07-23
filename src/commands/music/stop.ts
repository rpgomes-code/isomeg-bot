import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { getPlayer } from '../../music/player';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class StopCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "stop",
            description: "Stop the music player and clear the queue.",
            aliases: ["leave", "disconnect"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('stop')
                    .setDescription("Stop the music player and clear the queue."),
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
            user: {
                username: interaction.user.username,
                displayName: interaction.user.displayName
            },
            createdAt: interaction.createdAt
        });

        const player = getPlayer()!;
        const queue = player.nodes.get(interaction.guildId!);

        if (!queue || queue.deleted) {
            await interaction.reply({
                content: "Nothing is playing right now.",
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        queue.delete();
        await interaction.reply({
            content: "Music stopped and queue cleared. Disconnected from voice channel.",
            flags: [MessageFlags.Ephemeral]
        });
    }

    public override async messageRun(message: Message, _args: any): Promise<void> {
        const player = getPlayer()!;
        const queue = player.nodes.get(message.guildId!);
        if (!queue || queue.deleted) {
            await message.reply("Nothing is playing right now.");
            return;
        }
        queue.delete();
        await message.reply("Stopped and cleared queue. Disconnected from voice channel.");
    }
}
