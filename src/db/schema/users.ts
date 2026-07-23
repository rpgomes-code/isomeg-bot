import { pgTable, varchar, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { guilds } from "./guilds";
import { primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    guildId: varchar("guild_id", { length: 30 }).notNull().references(() => guilds.guildId),
    userId: varchar("user_id", { length: 30 }).notNull(),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(0),
    coins: integer("coins").notNull().default(0),
    dailyClaimedAt: timestamp("daily_claimed_at"),
    lastXpGain: timestamp("last_xp_gain"),
}, (table) => [
    primaryKey({ columns: [table.guildId, table.userId] }),
]);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
