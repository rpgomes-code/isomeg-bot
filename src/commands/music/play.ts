import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { getPlayer } from '../../music/player';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class PlayCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "play",
            description: "Play a song or playlist from YouTube/Spotify.",
            aliases: ["p", "music"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('play')
                    .setDescription("Play a song or playlist from YouTube/Spotify.")
                    .addStringOption((option) =>
                        option
                            .setName("query")
                            .setDescription("Song name or YouTube/Spotify URL")
                            .setRequired(true)
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

        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({
                content: "You need to be in a voice channel to play music.",
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const query = interaction.options.getString("query", true);
        const player = getPlayer()!;

        await interaction.deferReply();

        try {
            const result = await player.play(voiceChannel, query, {
                requestedBy: interaction.user,
                nodeOptions: {
                    metadata: {
                        channel: interaction.channel,
                    },
                },
            });

            const queue = player.nodes.get(interaction.guildId!)!;
            const trackCount = queue.tracks.size;
            const title = result.track?.title ?? query;

            await interaction.editReply(
                `Added \`${title}\` to the queue. (${trackCount + 1} track${trackCount > 0 ? 's' : ''})`
            );
        } catch (error) {
            await interaction.editReply(
                error instanceof Error ? error.message : "An unknown error occurred."
            );
        }
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        createCommandLog({
            command: this.name,
            guild: message.guild?.name ?? "DM",
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        const query = await args.rest('string').catch(() => null);
        if (!query) {
            await message.reply("Please provide a song name or URL! e.g. `$play Bohemian Rhapsody`");
            return;
        }

        const member = await message.guild?.members.fetch(message.author.id);
        const voiceChannel = member?.voice.channel;
        if (!voiceChannel) {
            await message.reply("You need to be in a voice channel to play music.");
            return;
        }

        try {
            const player = getPlayer()!;
            const result = await player.play(voiceChannel, query, { requestedBy: message.author });
            const queue = player.nodes.get(message.guildId!)!;
            const title = result.track?.title ?? query;
            await message.reply(`Now playing: \`${title}\``);
        } catch (error) {
            await message.reply(error instanceof Error ? error.message : "An unknown error occurred.");
        }
    }
}
