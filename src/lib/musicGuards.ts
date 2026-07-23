import type { ChatInputCommandInteraction, GuildMember, Message, VoiceBasedChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import type { GuildQueue, Player } from "discord-player";

export interface InteractionMusicContext {
    queue: GuildQueue;
    member: GuildMember;
    voiceChannel: VoiceBasedChannel;
}

export async function getInteractionVoiceChannel(interaction: ChatInputCommandInteraction): Promise<VoiceBasedChannel | null> {
    if (!interaction.guild) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: [MessageFlags.Ephemeral] });
        return null;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
        await interaction.reply({ content: "You need to be in a voice channel.", flags: [MessageFlags.Ephemeral] });
        return null;
    }

    return voiceChannel;
}

export async function getInteractionQueueContext(interaction: ChatInputCommandInteraction, player: Player): Promise<InteractionMusicContext | null> {
    if (!interaction.guild) {
        await interaction.reply({ content: "This command can only be used in a server.", flags: [MessageFlags.Ephemeral] });
        return null;
    }

    const queue = player.nodes.get(interaction.guild.id);
    if (!queue || queue.deleted) {
        await interaction.reply({ content: "Nothing is playing right now.", flags: [MessageFlags.Ephemeral] });
        return null;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
        await interaction.reply({ content: "You need to be in my voice channel to control music.", flags: [MessageFlags.Ephemeral] });
        return null;
    }

    if (!isSameVoiceChannel(queue, voiceChannel)) {
        await interaction.reply({ content: `Join ${queue.channel} to control the current queue.`, flags: [MessageFlags.Ephemeral] });
        return null;
    }

    return { queue, member, voiceChannel };
}

export async function getMessageQueueContext(message: Message, player: Player): Promise<{ queue: GuildQueue; voiceChannel: VoiceBasedChannel } | null> {
    if (!message.guild) {
        await message.reply("This command can only be used in a server.");
        return null;
    }

    const queue = player.nodes.get(message.guild.id);
    if (!queue || queue.deleted) {
        await message.reply("Nothing is playing right now.");
        return null;
    }

    const member = await message.guild.members.fetch(message.author.id);
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
        await message.reply("You need to be in my voice channel to control music.");
        return null;
    }

    if (!isSameVoiceChannel(queue, voiceChannel)) {
        await message.reply(`Join ${queue.channel} to control the current queue.`);
        return null;
    }

    return { queue, voiceChannel };
}

export function isSameVoiceChannel(queue: GuildQueue, voiceChannel: VoiceBasedChannel): boolean {
    return !queue.channel || queue.channel.id === voiceChannel.id;
}

export function repeatModeName(mode: number): string {
    switch (mode) {
        case 1:
            return "track";
        case 2:
            return "queue";
        case 3:
            return "autoplay";
        default:
            return "off";
    }
}
