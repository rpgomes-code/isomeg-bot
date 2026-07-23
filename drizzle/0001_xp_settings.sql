ALTER TABLE "guilds" ADD COLUMN "xp_cooldown_seconds" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "xp_min" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "xp_max" integer DEFAULT 30 NOT NULL;