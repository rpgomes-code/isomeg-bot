import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { getPlayer } from '../../music/player';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { getInteractionQueueContext, getMessageQueueContext } from "../../lib/musicGuards";

export class SkipCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "skip",
            description: "Skip the current track.",
            aliases: ["s"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('skip')
                    .setDescription("Skip the current track."),
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

        context.queue.node.skip();
        await interaction.reply({
            content: "Track skipped.",
            flags: [MessageFlags.Ephemeral]
        });
    }

    public override async messageRun(message: Message, _args: any): Promise<void> {
        const context = await getMessageQueueContext(message, getPlayer());
        if (!context) return;
        context.queue.node.skip();
        await message.reply("Track skipped.");
    }
}
