import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { activityDaily } from "../db/schema";

export interface ActivitySummary {
    totalMessages: number;
    activeUsers: number;
    activeChannels: number;
    topUsers: Array<{ userId: string; messages: number }>;
    topChannels: Array<{ channelId: string; messages: number }>;
}

export function getActivityDateKey(date = new Date()): string {
    return date.toISOString().slice(0, 10);
}

export async function recordMessageActivity(guildId: string, channelId: string, userId: string, date = new Date()): Promise<void> {
    await db
        .insert(activityDaily)
        .values({
            guildId,
            activityDate: getActivityDateKey(date),
            channelId,
            userId,
            messageCount: 1,
        })
        .onConflictDoUpdate({
            target: [activityDaily.guildId, activityDaily.activityDate, activityDaily.channelId, activityDaily.userId],
            set: {
                messageCount: sql`${activityDaily.messageCount} + 1`,
                updatedAt: new Date(),
            },
        });
}

export async function getActivitySummary(guildId: string, days: number): Promise<ActivitySummary> {
    const safeDays = Math.min(Math.max(Math.floor(days), 1), 30);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - safeDays + 1);
    const startKey = getActivityDateKey(start);

    const rows = await db
        .select()
        .from(activityDaily)
        .where(and(eq(activityDaily.guildId, guildId), gte(activityDaily.activityDate, startKey)));

    const userCounts = new Map<string, number>();
    const channelCounts = new Map<string, number>();
    let totalMessages = 0;

    for (const row of rows) {
        totalMessages += row.messageCount;
        userCounts.set(row.userId, (userCounts.get(row.userId) ?? 0) + row.messageCount);
        channelCounts.set(row.channelId, (channelCounts.get(row.channelId) ?? 0) + row.messageCount);
    }

    return {
        totalMessages,
        activeUsers: userCounts.size,
        activeChannels: channelCounts.size,
        topUsers: topEntries(userCounts, "userId"),
        topChannels: topEntries(channelCounts, "channelId"),
    };
}

function topEntries<Key extends "userId" | "channelId">(
    counts: Map<string, number>,
    key: Key
): Array<Record<Key, string> & { messages: number }> {
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, messages]) => ({ [key]: id, messages }) as Record<Key, string> & { messages: number });
}
