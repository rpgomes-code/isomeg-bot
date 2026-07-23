import { sql } from "drizzle-orm";
import { index, pgTable, uuid, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { guilds } from "./guilds";

export const warns = pgTable("warns", {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    guildId: varchar("guild_id", { length: 30 }).notNull().references(() => guilds.guildId),
    userId: varchar("user_id", { length: 30 }).notNull(),
    reason: text("reason").notNull(),
    moderatorId: varchar("moderator_id", { length: 30 }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    index("warns_guild_user_idx").on(table.guildId, table.userId),
]);

export type WarnRow = typeof warns.$inferSelect;
export type NewWarnRow = typeof warns.$inferInsert;
