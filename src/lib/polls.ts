import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    EmbedBuilder,
} from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { pollVotes, polls, type PollRow } from "../db/schema";

const MAX_OPTIONS = 5;

export function normalizePollOptions(options: string[]): string[] {
    const normalized = options
        .map((option) => option.trim())
        .filter(Boolean)
        .map((option) => option.slice(0, 80));

    return [...new Set(normalized)].slice(0, MAX_OPTIONS);
}

export function parsePrefixPollInput(input: string): { question: string; options: string[] } | null {
    const parts = input.split("|").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 3) return null;
    const [question, ...options] = parts;
    return { question, options: normalizePollOptions(options) };
}

export async function createPoll(values: {
    guildId: string;
    channelId: string;
    createdById: string;
    question: string;
    options: string[];
    anonymous: boolean;
    expiresAt?: Date | null;
}): Promise<PollRow> {
    const result = await db
        .insert(polls)
        .values({
            ...values,
            messageId: null,
        })
        .returning();

    return result[0];
}

export async function setPollMessageId(pollId: string, messageId: string): Promise<void> {
    await db
        .update(polls)
        .set({ messageId, updatedAt: new Date() })
        .where(eq(polls.id, pollId));
}

export async function getPoll(pollId: string): Promise<PollRow | null> {
    const result = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1);
    return result[0] ?? null;
}

export async function closePoll(pollId: string, guildId: string): Promise<PollRow | null> {
    const result = await db
        .update(polls)
        .set({ closed: true, updatedAt: new Date() })
        .where(and(eq(polls.id, pollId), eq(polls.guildId, guildId)))
        .returning();

    return result[0] ?? null;
}

export async function recordPollVote(poll: PollRow, userId: string, optionIndex: number): Promise<void> {
    await db
        .insert(pollVotes)
        .values({
            pollId: poll.id,
            userId,
            optionIndex,
        })
        .onConflictDoUpdate({
            target: [pollVotes.pollId, pollVotes.userId],
            set: {
                optionIndex,
                updatedAt: new Date(),
            },
        });
}

export async function getPollVoteCounts(pollId: string, optionCount: number): Promise<number[]> {
    const rows = await db
        .select({
            optionIndex: pollVotes.optionIndex,
            count: sql<number>`count(*)::int`,
        })
        .from(pollVotes)
        .where(eq(pollVotes.pollId, pollId))
        .groupBy(pollVotes.optionIndex);

    const counts = Array.from({ length: optionCount }, () => 0);
    for (const row of rows) {
        if (row.optionIndex >= 0 && row.optionIndex < optionCount) {
            counts[row.optionIndex] = Number(row.count);
        }
    }

    return counts;
}

export function isPollExpired(poll: PollRow, now = new Date()): boolean {
    return Boolean(poll.expiresAt && poll.expiresAt.getTime() <= now.getTime());
}

export async function createPollEmbed(poll: PollRow): Promise<EmbedBuilder> {
    const options = poll.options;
    const counts = await getPollVoteCounts(poll.id, options.length);
    const totalVotes = counts.reduce((sum, count) => sum + count, 0);
    const ended = poll.closed || isPollExpired(poll);

    const lines = options.map((option, index) => {
        const count = counts[index];
        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return `**${index + 1}. ${option}** - ${count} vote${count === 1 ? "" : "s"} (${percent}%)`;
    });

    const footer = [
        `Poll ID: ${poll.id}`,
        poll.anonymous ? "Anonymous voting" : "Voting",
        ended ? "Closed" : "Open",
    ];

    if (poll.expiresAt && !ended) {
        footer.push(`Ends ${poll.expiresAt.toISOString().slice(0, 16)} UTC`);
    }

    return new EmbedBuilder()
        .setTitle(poll.question)
        .setDescription(lines.join("\n"))
        .setColor(ended ? Colors.Grey : Colors.DarkAqua)
        .setFooter({ text: footer.join(" | ") })
        .setTimestamp();
}

export function createPollComponents(poll: PollRow): ActionRowBuilder<ButtonBuilder>[] {
    if (poll.closed || isPollExpired(poll)) return [];

    const row = new ActionRowBuilder<ButtonBuilder>();
    poll.options.forEach((option, index) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`poll:${poll.id}:${index}`)
                .setLabel(`${index + 1}`)
                .setStyle(ButtonStyle.Secondary)
        );
    });

    return [row];
}
