import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message, MessageFlags } from "discord.js";
import { getPlayer } from "../../music/player";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { getInteractionVoiceChannel, isSameVoiceChannel } from "../../lib/musicGuards";

export class PlayCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "play",
            description: "Play a song or playlist from YouTube/Spotify.",
            aliases: ["p", "music"],
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName("play")
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
            user: { username: interaction.user.username, displayName: interaction.user.displayName },
            createdAt: interaction.createdAt,
        });

        const voiceChannel = await getInteractionVoiceChannel(interaction);
        if (!voiceChannel || !interaction.guild) return;

        const query = interaction.options.getString("query", true);
        const player = getPlayer();
        const existingQueue = player.nodes.get(interaction.guild.id);
        if (existingQueue && !existingQueue.deleted && !isSameVoiceChannel(existingQueue, voiceChannel)) {
            await interaction.reply({
                content: `I am already playing in ${existingQueue.channel}. Join that channel to add tracks.`,
                flags: [MessageFlags.Ephemeral],
            });
            return;
        }

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

            const queue = player.nodes.get(interaction.guild.id)!;
            const trackCount = queue.tracks.size;
            const title = result.track?.title ?? query;

            await interaction.editReply(
                `Added \`${title}\` to the queue. (${trackCount + 1} track${trackCount > 0 ? "s" : ""})`
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
            user: { username: message.author.username, displayName: message.author.username },
            createdAt: message.createdAt,
        });

        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        const query = await args.rest("string").catch(() => null);
        if (!query) {
            await message.reply("Please provide a song name or URL. Example: `$play Bohemian Rhapsody`");
            return;
        }

        const member = await message.guild.members.fetch(message.author.id);
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            await message.reply("You need to be in a voice channel to play music.");
            return;
        }

        try {
            const player = getPlayer();
            const existingQueue = player.nodes.get(message.guild.id);
            if (existingQueue && !existingQueue.deleted && !isSameVoiceChannel(existingQueue, voiceChannel)) {
                await message.reply(`I am already playing in ${existingQueue.channel}. Join that channel to add tracks.`);
                return;
            }

            const result = await player.play(voiceChannel, query, { requestedBy: message.author });
            const title = result.track?.title ?? query;
            await message.reply(`Added \`${title}\` to the queue.`);
        } catch (error) {
            await message.reply(error instanceof Error ? error.message : "An unknown error occurred.");
        }
    }
}
