import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { getPlayer } from '../../music/player';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { getInteractionQueueContext, getMessageQueueContext } from "../../lib/musicGuards";

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

        const context = await getInteractionQueueContext(interaction, getPlayer());
        if (!context) return;
        const queue = context.queue;

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
        const context = await getMessageQueueContext(message, getPlayer());
        if (!context) return;
        const queue = context.queue;
        if (queue.tracks.size === 0) {
            await message.reply("Nothing to shuffle.");
            return;
        }
        queue.tracks.shuffle();
        await message.reply("Queue shuffled.");
    }
}
