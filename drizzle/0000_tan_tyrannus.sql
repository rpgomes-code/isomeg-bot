CREATE TABLE "guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(30) NOT NULL,
	"guild_name" varchar(100),
	"prefix" varchar(5) DEFAULT '$' NOT NULL,
	"welcome_channel_id" varchar(30),
	"mod_log_channel_id" varchar(30),
	"xp_channel_id" varchar(30),
	"xp_notify_in_dm" boolean DEFAULT true NOT NULL,
	"xp_enabled" boolean DEFAULT true NOT NULL,
	"music_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guilds_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "warns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(30) NOT NULL,
	"user_id" varchar(30) NOT NULL,
	"reason" text NOT NULL,
	"moderator_id" varchar(30) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"guild_id" varchar(30) NOT NULL,
	"user_id" varchar(30) NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"daily_claimed_at" timestamp,
	"last_xp_gain" timestamp,
	CONSTRAINT "users_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "warns" ADD CONSTRAINT "warns_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "warns_guild_user_idx" ON "warns" USING btree ("guild_id","user_id");
