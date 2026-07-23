import type { Client, Guild } from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { birthdays, guilds, type BirthdayRow } from "../db/schema";

export function isValidBirthday(month: number, day: number): boolean {
    if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
    if (month < 1 || month > 12 || day < 1) return false;
    return day <= new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

export function formatBirthday(month: number, day: number): string {
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(2024, month - 1, day)));
}

export async function setBirthday(guildId: string, userId: string, month: number, day: number): Promise<BirthdayRow> {
    if (!isValidBirthday(month, day)) {
        throw new Error("Please provide a valid month and day.");
    }

    const result = await db
        .insert(birthdays)
        .values({ guildId, userId, month, day })
        .onConflictDoUpdate({
            target: [birthdays.guildId, birthdays.userId],
            set: { month, day, updatedAt: new Date() },
        })
        .returning();

    return result[0];
}

export async function removeBirthday(guildId: string, userId: string): Promise<boolean> {
    const result = await db
        .delete(birthdays)
        .where(and(eq(birthdays.guildId, guildId), eq(birthdays.userId, userId)))
        .returning({ userId: birthdays.userId });

    return result.length > 0;
}

export async function getBirthday(guildId: string, userId: string): Promise<BirthdayRow | null> {
    const result = await db
        .select()
        .from(birthdays)
        .where(and(eq(birthdays.guildId, guildId), eq(birthdays.userId, userId)))
        .limit(1);

    return result[0] ?? null;
}

export async function listBirthdays(guildId: string): Promise<BirthdayRow[]> {
    return db
        .select()
        .from(birthdays)
        .where(eq(birthdays.guildId, guildId))
        .orderBy(birthdays.month, birthdays.day);
}

export async function runBirthdayReminders(client: Client): Promise<number> {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    const year = now.getUTCFullYear();
    let sent = 0;

    const rows = await db
        .select({
            guildId: birthdays.guildId,
            userId: birthdays.userId,
            birthdayChannelId: guilds.birthdayChannelId,
        })
        .from(birthdays)
        .innerJoin(guilds, eq(birthdays.guildId, guilds.guildId))
        .where(and(
            eq(birthdays.month, month),
            eq(birthdays.day, day),
            sql`${guilds.birthdayChannelId} is not null`,
            sql`(${birthdays.lastAnnouncedYear} is null or ${birthdays.lastAnnouncedYear} <> ${year})`
        ));

    for (const row of rows) {
        const guild = await client.guilds.fetch(row.guildId).catch(() => null);
        if (!guild || !row.birthdayChannelId) continue;

        const sentForUser = await sendBirthdayMessage(guild, row.birthdayChannelId, row.userId);
        if (!sentForUser) continue;

        await db
            .update(birthdays)
            .set({ lastAnnouncedYear: year, updatedAt: new Date() })
            .where(and(eq(birthdays.guildId, row.guildId), eq(birthdays.userId, row.userId)));
        sent++;
    }

    return sent;
}

export function startBirthdayReminderScheduler(client: Client, logger: { info: (message: string) => void; warn: (message: string) => void }): void {
    const run = () => {
        runBirthdayReminders(client)
            .then((count) => {
                if (count > 0) logger.info(`[Birthdays] Sent ${count} birthday reminder${count === 1 ? "" : "s"}.`);
            })
            .catch((error) => logger.warn(`[Birthdays] Reminder check failed: ${error instanceof Error ? error.message : error}`));
    };

    run();
    setInterval(run, 60 * 60 * 1000);
}

async function sendBirthdayMessage(guild: Guild, channelId: string, userId: string): Promise<boolean> {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || !("send" in channel)) return false;

    await channel.send(`Happy birthday <@${userId}>!`);
    return true;
}
