import { db } from "../db";
import { users } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

export const XP_MIN = 10;
export const XP_MAX = 30;
export const XP_COOLDOWN_MS = 30 * 1000; // 30 seconds
export const LEVEL_BASE = 100;
export const LEVEL_MULTIPLIER = 1.5;
export const DAILY_COINS = 100;

export function calculateXpForLevel(level: number): number {
    return Math.floor(LEVEL_BASE * Math.pow(level, LEVEL_MULTIPLIER));
}

export function getRandomXp(): number {
    return Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
}

export function calculateLevel(xp: number): { level: number; xpInLevel: number; xpToNext: number } {
    let remaining = xp;
    let level = 0;

    while (true) {
        const xpForNext = calculateXpForLevel(level + 1);
        if (remaining < xpForNext) break;
        remaining -= xpForNext;
        level++;
    }

    return {
        level,
        xpInLevel: remaining,
        xpToNext: calculateXpForLevel(level + 1) - remaining,
    };
}

export async function addXp(
    guildId: string,
    userId: string,
    xpAmount: number
): Promise<{ awarded: boolean; leveledUp: boolean; newLevel: number }> {
    const now = new Date();
    const existing = await getUserData(guildId, userId);

    if (existing) {
        if (existing.lastXpGain && now.getTime() - existing.lastXpGain.getTime() < XP_COOLDOWN_MS) {
            return { awarded: false, leveledUp: false, newLevel: existing.level };
        }

        const newTotalXp = existing.xp + xpAmount;
        const newLevelInfo = calculateLevel(newTotalXp);
        const leveledUp = newLevelInfo.level > existing.level;

        await db
            .update(users)
            .set({
                xp: newTotalXp,
                level: newLevelInfo.level,
                lastXpGain: now,
            })
            .where(and(eq(users.guildId, guildId), eq(users.userId, userId)));

        return { awarded: true, leveledUp, newLevel: newLevelInfo.level };
    }

    const newLevelInfo = calculateLevel(xpAmount);

    await db.insert(users).values({
        guildId,
        userId,
        xp: xpAmount,
        level: newLevelInfo.level,
        lastXpGain: now,
    }).onConflictDoNothing();

    return { awarded: true, leveledUp: newLevelInfo.level > 0, newLevel: newLevelInfo.level };
}

export async function getUserData(guildId: string, userId: string) {
    const result = await db
        .select()
        .from(users)
        .where(and(eq(users.guildId, guildId), eq(users.userId, userId)))
        .limit(1);

    return result[0] ?? null;
}

export async function getLeaderboard(guildId: string, limit = 10) {
    return db
        .select()
        .from(users)
        .where(eq(users.guildId, guildId))
        .orderBy(sql`${users.xp} DESC`)
        .limit(limit);
}
