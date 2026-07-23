import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags, Message } from 'discord.js';
import { getPlayer } from '../../music/player';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class QueueCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "queue",
            description: "Display the current music queue.",
            aliases: ["q"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('queue')
                    .setDescription("Display the current music queue."),
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

        const track = queue.currentTrack!;
        const tracks = queue.tracks.map((t, i) => `${i + 1}. **${t.title}**`).slice(0, 10);
        const remaining = queue.tracks.size - tracks.length;

        let description = `🎶 **Now playing:** ${track.title}\n\n`;
        if (tracks.length > 0) {
            description += tracks.join('\n');
        } else {
            description += "*No tracks in queue*";
        }
        if (remaining > 0) {
            description += `\n\n...and ${remaining} more track${remaining > 1 ? 's' : ''}`;
        }

        description += `\n\n**Volume:** ${queue.options.volume}%`;
        description += `\n**Repeat mode:** ${queue.repeatMode}`;

        const embed = new EmbedBuilder()
            .setTitle("Queue")
            .setColor(Colors.DarkAqua)
            .setDescription(description)
            .setTimestamp()
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await interaction.reply({ embeds: [embed] });
    }

    public override async messageRun(message: Message, _args: any): Promise<void> {
        const player = getPlayer()!;
        const queue = player.nodes.get(message.guildId!);
        if (!queue || queue.deleted) {
            await message.reply("Nothing is playing right now.");
            return;
        }
        const track = queue.currentTrack!;
        const trackCount = queue.tracks.size;
        await message.reply(`🎶 Now playing: ${track.title} | ${trackCount} tracks in queue | Volume: ${queue.options.volume}%`);
    }
}
