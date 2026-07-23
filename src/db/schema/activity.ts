import { integer, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { guilds } from "./guilds";

export const activityDaily = pgTable("activity_daily", {
    guildId: varchar("guild_id", { length: 30 }).notNull().references(() => guilds.guildId),
    activityDate: varchar("activity_date", { length: 10 }).notNull(),
    channelId: varchar("channel_id", { length: 30 }).notNull(),
    userId: varchar("user_id", { length: 30 }).notNull(),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    primaryKey({ columns: [table.guildId, table.activityDate, table.channelId, table.userId] }),
]);

export type ActivityDailyRow = typeof activityDaily.$inferSelect;
export type NewActivityDailyRow = typeof activityDaily.$inferInsert;
