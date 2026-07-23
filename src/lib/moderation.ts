import {
    Guild,
    GuildMember,
    PermissionFlagsBits,
    TextChannel,
    User,
    type PermissionResolvable,
} from "discord.js";
import { db } from "../db";
import { guilds, warns } from "../db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function getModLogChannel(guild: Guild): Promise<TextChannel | null> {
    const result = await db
        .select({ modLogChannelId: guilds.modLogChannelId })
        .from(guilds)
        .where(eq(guilds.guildId, guild.id))
        .limit(1);

    if (result.length === 0 || !result[0].modLogChannelId) {
        return null;
    }

    const channel = guild.channels.cache.get(result[0].modLogChannelId);
    if (!channel?.isTextBased()) {
        return null;
    }

    return channel as TextChannel;
}

export async function logModAction(
    guild: Guild,
    action: string,
    target: User | GuildMember,
    moderator: User | GuildMember,
    reason?: string
): Promise<void> {
    const channel = await getModLogChannel(guild);
    if (!channel) return;

    const targetName = "user" in target ? target.user.tag : target.tag;
    const modName = "user" in moderator ? moderator.user.tag : moderator.tag;

    const embed = {
        title: `${action}`,
        fields: [
            { name: "Target", value: targetName, inline: true },
            { name: "Moderator", value: modName, inline: true },
            { name: "Reason", value: reason || "No reason provided", inline: false },
        ],
        timestamp: new Date().toISOString(),
        color: action.includes("Ban") ? 0xff0000 : action.includes("Kick") ? 0xff8800 : action.includes("Mute") ? 0xffaa00 : 0xff4444,
    };

    await channel.send({ embeds: [embed] });
}

export async function addWarn(
    guildId: string,
    userId: string,
    moderatorId: string,
    reason: string
) {
    const result = await db
        .insert(warns)
        .values({ guildId, userId, moderatorId, reason })
        .returning();

    return result[0];
}

export async function getUserWarns(guildId: string, userId: string) {
    return db
        .select()
        .from(warns)
        .where(and(eq(warns.guildId, guildId), eq(warns.userId, userId), eq(warns.active, true)))
        .orderBy(desc(warns.createdAt));
}

export async function deleteUserWarn(warnId: string): Promise<boolean> {
    const result = await db
        .update(warns)
        .set({ active: false })
        .where(and(eq(warns.id, warnId), eq(warns.active, true)))
        .returning({ id: warns.id });

    return result.length > 0;
}

export interface ModRoleCheck {
    hasPermission: boolean;
    targetHigher: boolean;
    botHigher: boolean;
}

export function hasModeratorPermission(
    moderator: GuildMember,
    permission: PermissionResolvable = PermissionFlagsBits.ModerateMembers
): boolean {
    return moderator.permissions.has(PermissionFlagsBits.Administrator) || moderator.permissions.has(permission);
}

export function checkModPermissions(
    moderator: GuildMember,
    target: GuildMember,
    bot: GuildMember,
    permission: PermissionResolvable = PermissionFlagsBits.ModerateMembers
): ModRoleCheck {
    const moderatorIsGuildOwner = moderator.guild.ownerId === moderator.id;
    const targetIsGuildOwner = target.guild.ownerId === target.id;
    const selfTarget = moderator.id === target.id;

    const hasPermission = hasModeratorPermission(moderator, permission);
    const targetHigher = selfTarget || (!moderatorIsGuildOwner && (targetIsGuildOwner || moderator.roles.highest.comparePositionTo(target.roles.highest) <= 0));
    const botHigher = targetIsGuildOwner || bot.roles.highest.comparePositionTo(target.roles.highest) <= 0;

    return { hasPermission, targetHigher, botHigher };
}

export function getModPermissionFailure(check: ModRoleCheck, action: string): string | null {
    if (!check.hasPermission) {
        return `You don't have permission to ${action} users.`;
    }

    if (check.targetHigher) {
        return `Cannot ${action} a user with equal or higher role than you.`;
    }

    if (check.botHigher) {
        return `I can't ${action} users with equal or higher role than me.`;
    }

    return null;
}
