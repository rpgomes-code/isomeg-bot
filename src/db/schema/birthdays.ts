import { integer, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { guilds } from "./guilds";

export const birthdays = pgTable("birthdays", {
    guildId: varchar("guild_id", { length: 30 }).notNull().references(() => guilds.guildId),
    userId: varchar("user_id", { length: 30 }).notNull(),
    month: integer("month").notNull(),
    day: integer("day").notNull(),
    lastAnnouncedYear: integer("last_announced_year"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    primaryKey({ columns: [table.guildId, table.userId] }),
]);

export type BirthdayRow = typeof birthdays.$inferSelect;
export type NewBirthdayRow = typeof birthdays.$inferInsert;
