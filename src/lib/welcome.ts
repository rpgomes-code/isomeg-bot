import type { Guild, GuildMember, PartialGuildMember } from "discord.js";
import { ensureGuildSettings } from "./guildSettings";

export const DEFAULT_WELCOME_MESSAGE = "Welcome {user} to {server}. You are member #{memberCount}.";
export const DEFAULT_GOODBYE_MESSAGE = "{userTag} left {server}. We are now at {memberCount} members.";

export function formatGuildMemberMessage(
    template: string,
    member: GuildMember | PartialGuildMember
): string {
    const user = member.user;
    return template
        .replaceAll("{user}", user.toString())
        .replaceAll("{userTag}", user.tag)
        .replaceAll("{username}", user.username)
        .replaceAll("{server}", member.guild.name)
        .replaceAll("{memberCount}", member.guild.memberCount.toLocaleString());
}

export async function sendConfiguredMemberMessage(
    guild: Guild,
    member: GuildMember | PartialGuildMember,
    type: "welcome" | "goodbye"
): Promise<boolean> {
    const settings = await ensureGuildSettings(guild.id, guild.name);
    const enabled = type === "welcome" ? settings.welcomeEnabled : settings.goodbyeEnabled;
    const channelId = type === "welcome" ? settings.welcomeChannelId : settings.goodbyeChannelId;
    if (!enabled || !channelId) return false;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || !("send" in channel)) return false;

    const template = type === "welcome"
        ? settings.welcomeMessage ?? DEFAULT_WELCOME_MESSAGE
        : settings.goodbyeMessage ?? DEFAULT_GOODBYE_MESSAGE;

    await channel.send(formatGuildMemberMessage(template, member));
    return true;
}
