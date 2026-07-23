import {
    Colors,
    EmbedBuilder,
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

    const targetUser = "user" in target ? target.user : target;
    const moderatorUser = "user" in moderator ? moderator.user : moderator;
    const color = action.includes("Ban")
        ? Colors.Red
        : action.includes("Kick")
            ? Colors.Orange
            : action.includes("Mute")
                ? Colors.Yellow
                : Colors.DarkRed;

    const embed = new EmbedBuilder()
        .setTitle(`Moderation Audit: ${action}`)
        .setColor(color)
        .addFields([
            { name: "Target", value: `${targetUser.tag}\n\`${targetUser.id}\``, inline: true },
            { name: "Moderator", value: `${moderatorUser.tag}\n\`${moderatorUser.id}\``, inline: true },
            { name: "Reason", value: reason || "No reason provided", inline: false },
        ])
        .setTimestamp();

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
