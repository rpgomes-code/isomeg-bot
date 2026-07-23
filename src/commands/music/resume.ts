import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { getPlayer } from '../../music/player';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { getInteractionQueueContext, getMessageQueueContext } from "../../lib/musicGuards";

export class ResumeCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "resume",
            description: "Resume the paused music.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('resume')
                    .setDescription("Resume the paused music."),
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

        context.queue.node.setPaused(false);
        await interaction.reply({
            content: "Music resumed.",
            flags: [MessageFlags.Ephemeral]
        });
    }

    public override async messageRun(message: Message, _args: any): Promise<void> {
        const context = await getMessageQueueContext(message, getPlayer());
        if (!context) return;
        context.queue.node.setPaused(false);
        await message.reply("Resumed.");
    }
}
