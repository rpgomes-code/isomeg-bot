import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { guilds } from "./guilds";

export const bingoEvents = pgTable("bingo_events", {
    id: uuid("id").defaultRandom().primaryKey(),
    guildId: varchar("guild_id", { length: 30 }).notNull().references(() => guilds.guildId),
    createdById: varchar("created_by_id", { length: 30 }).notNull(),
    title: varchar("title", { length: 100 }).notNull(),
    status: varchar("status", { length: 10 }).$type<"open" | "live" | "ended">().notNull().default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    index("bingo_events_guild_idx").on(table.guildId),
    check("bingo_events_status_check", sql`${table.status} in ('open', 'live', 'ended')`),
]);

export const bingoCards = pgTable("bingo_cards", {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").notNull().references(() => bingoEvents.id, { onDelete: "cascade" }),
    createdById: varchar("created_by_id", { length: 30 }).notNull(),
    predictions: jsonb("predictions").$type<string[]>().notNull(),
    marks: integer("marks").notNull().default(0),
    revision: integer("revision").notNull().default(0),
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    unique("bingo_cards_event_creator_unique").on(table.eventId, table.createdById),
    check("bingo_cards_predictions_check", sql`jsonb_typeof(${table.predictions}) = 'array' and jsonb_array_length(${table.predictions}) = 25`),
    check("bingo_cards_marks_check", sql`${table.marks} between 0 and 33554431`),
]);

export type BingoEvent = typeof bingoEvents.$inferSelect;
export type BingoCard = typeof bingoCards.$inferSelect;
