import { eq } from "drizzle-orm";
import { db } from "../db";
import { guilds, type GuildRow } from "../db/schema";
import { DEFAULT_PREFIX, DEFAULT_XP_COOLDOWN_SECONDS, DEFAULT_XP_MAX, DEFAULT_XP_MIN } from "../constants/defaults";

export async function ensureGuildSettings(guildId: string, guildName: string): Promise<GuildRow> {
    const existing = await getGuildSettings(guildId);
    if (existing) return existing;

    await db
        .insert(guilds)
        .values({
            guildId,
            guildName,
            prefix: DEFAULT_PREFIX,
            welcomeEnabled: true,
            goodbyeEnabled: true,
            xpEnabled: true,
            xpNotifyInDm: true,
            xpCooldownSeconds: DEFAULT_XP_COOLDOWN_SECONDS,
            xpMin: DEFAULT_XP_MIN,
            xpMax: DEFAULT_XP_MAX,
            musicEnabled: true,
        })
        .onConflictDoNothing();

    const settings = await getGuildSettings(guildId);
    if (!settings) {
        throw new Error(`Failed to load settings for guild ${guildId}`);
    }

    return settings;
}

export async function getGuildSettings(guildId: string): Promise<GuildRow | null> {
    const result = await db
        .select()
        .from(guilds)
        .where(eq(guilds.guildId, guildId))
        .limit(1);

    return result[0] ?? null;
}

export async function updateGuildSettings(guildId: string, values: Partial<typeof guilds.$inferInsert>): Promise<GuildRow | null> {
    const result = await db
        .update(guilds)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(guilds.guildId, guildId))
        .returning();

    return result[0] ?? null;
}

export function normalizePrefix(prefix: string): string {
    const normalized = prefix.trim();
    if (normalized.length < 1 || normalized.length > 5) {
        throw new Error("Prefix must be between 1 and 5 characters.");
    }

    if (/\s/.test(normalized)) {
        throw new Error("Prefix cannot contain whitespace.");
    }

    return normalized;
}

export function normalizeXpRange(min: number, max: number): { min: number; max: number } {
    if (min < 1 || max < 1) {
        throw new Error("XP range values must be at least 1.");
    }

    if (min > max) {
        throw new Error("Minimum XP cannot be greater than maximum XP.");
    }

    return { min, max };
}
