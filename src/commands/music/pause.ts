import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { getPlayer } from '../../music/player';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class PauseCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "pause",
            description: "Pause the current track.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('pause')
                    .setDescription("Pause the current track."),
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

        queue.node.setPaused(true);
        await interaction.reply({
            content: "Music paused.",
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
        queue.node.setPaused(true);
        await message.reply("Paused.");
    }
}
