import { db } from "../db";
import { users } from "../db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { DEFAULT_XP_COOLDOWN_SECONDS, DEFAULT_XP_MAX, DEFAULT_XP_MIN } from "../constants/defaults";

export const XP_MIN = DEFAULT_XP_MIN;
export const XP_MAX = DEFAULT_XP_MAX;
export const XP_COOLDOWN_MS = DEFAULT_XP_COOLDOWN_SECONDS * 1000;
export const LEVEL_BASE = 100;
export const LEVEL_MULTIPLIER = 1.5;
export const DAILY_COINS = 100;

export function calculateXpForLevel(level: number): number {
    return Math.floor(LEVEL_BASE * Math.pow(level, LEVEL_MULTIPLIER));
}

export function getRandomXp(min = XP_MIN, max = XP_MAX): number {
    const safeMin = Math.max(1, Math.floor(min));
    const safeMax = Math.max(safeMin, Math.floor(max));
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

export function isXpOnCooldown(lastXpGain: Date | null | undefined, now: Date, cooldownMs: number): boolean {
    return Boolean(lastXpGain && now.getTime() - lastXpGain.getTime() < cooldownMs);
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
    xpAmount: number,
    cooldownMs = XP_COOLDOWN_MS,
    now = new Date()
): Promise<{ awarded: boolean; leveledUp: boolean; newLevel: number }> {
    const existing = await getUserData(guildId, userId);

    if (existing) {
        if (isXpOnCooldown(existing.lastXpGain, now, cooldownMs)) {
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

export async function getUserRank(guildId: string, userId: string, xp: number): Promise<number | null> {
    const user = await getUserData(guildId, userId);
    if (!user) return null;

    const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.guildId, guildId), gt(users.xp, xp)))
        .limit(1);

    return Number(result[0]?.count ?? 0) + 1;
}
