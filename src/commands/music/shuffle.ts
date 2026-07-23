import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { getPlayer } from '../../music/player';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class ShuffleCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "shuffle",
            description: "Shuffle the music queue.",
            aliases: ["mix"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('shuffle')
                    .setDescription("Shuffle the music queue."),
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

        if (queue.tracks.size === 0) {
            await interaction.reply({
                content: "Nothing to shuffle.",
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        queue.tracks.shuffle();
        await interaction.reply({
            content: "Queue shuffled.",
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
        if (queue.tracks.size === 0) {
            await message.reply("Nothing to shuffle.");
            return;
        }
        queue.tracks.shuffle();
        await message.reply("Queue shuffled.");
    }
}
