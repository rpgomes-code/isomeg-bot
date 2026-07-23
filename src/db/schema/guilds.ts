import { sql } from "drizzle-orm";
import { integer, pgTable, uuid, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

const timestamps = {
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
};

export const guilds = pgTable("guilds", {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    guildId: varchar("guild_id", { length: 30 }).notNull().unique(),
    guildName: varchar("guild_name", { length: 100 }),
    prefix: varchar("prefix", { length: 5 }).notNull().default("$"),
    welcomeChannelId: varchar("welcome_channel_id", { length: 30 }),
    modLogChannelId: varchar("mod_log_channel_id", { length: 30 }),
    xpChannelId: varchar("xp_channel_id", { length: 30 }),
    xpNotifyInDm: boolean("xp_notify_in_dm").notNull().default(true),
    xpEnabled: boolean("xp_enabled").notNull().default(true),
    xpCooldownSeconds: integer("xp_cooldown_seconds").notNull().default(30),
    xpMin: integer("xp_min").notNull().default(10),
    xpMax: integer("xp_max").notNull().default(30),
    musicEnabled: boolean("music_enabled").notNull().default(true),
    ...timestamps,
});

export type GuildRow = typeof guilds.$inferSelect;
export type NewGuildRow = typeof guilds.$inferInsert;
