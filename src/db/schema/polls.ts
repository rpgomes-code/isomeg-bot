import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { guilds } from "./guilds";

export const polls = pgTable("polls", {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    guildId: varchar("guild_id", { length: 30 }).notNull().references(() => guilds.guildId),
    channelId: varchar("channel_id", { length: 30 }).notNull(),
    messageId: varchar("message_id", { length: 30 }),
    createdById: varchar("created_by_id", { length: 30 }).notNull(),
    question: text("question").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    anonymous: boolean("anonymous").notNull().default(true),
    closed: boolean("closed").notNull().default(false),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pollVotes = pgTable("poll_votes", {
    pollId: uuid("poll_id").notNull().references(() => polls.id),
    userId: varchar("user_id", { length: 30 }).notNull(),
    optionIndex: integer("option_index").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    primaryKey({ columns: [table.pollId, table.userId] }),
]);

export type PollRow = typeof polls.$inferSelect;
export type NewPollRow = typeof polls.$inferInsert;
export type PollVoteRow = typeof pollVotes.$inferSelect;
export type NewPollVoteRow = typeof pollVotes.$inferInsert;
