import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { getPlayer } from '../../music/player';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class VolumeCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "volume",
            description: "Set or check the volume.",
            aliases: ["vol"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('volume')
                    .setDescription("Set or check the volume.")
                    .addIntegerOption((option) =>
                        option
                            .setName("value")
                            .setDescription("Volume level (0-100)")
                            .setRequired(false)
                            .setMinValue(0)
                            .setMaxValue(100)
                    ),
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

        const volume = interaction.options.getInteger("value");

        if (volume === null) {
            await interaction.reply({
                content: `Current volume: **${queue.options.volume}%**`,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        queue.node.setVolume(volume);
        await interaction.reply({
            content: `Volume set to **${volume}%**`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const player = getPlayer()!;
        const queue = player.nodes.get(message.guildId!);
        if (!queue || queue.deleted) {
            await message.reply("Nothing is playing right now.");
            return;
        }

        const volume = parseInt(await args.single('string').catch(() => null));
        if (isNaN(volume)) {
            await message.reply(`Current volume: ${queue.options.volume}%`);
            return;
        }

        const clampedVol = Math.min(Math.max(volume, 0), 100);
        queue.node.setVolume(clampedVol);
        await message.reply(`Volume set to ${clampedVol}%`);
    }
}
