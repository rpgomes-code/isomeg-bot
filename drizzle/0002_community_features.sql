CREATE TABLE "activity_daily" (
	"guild_id" varchar(30) NOT NULL,
	"activity_date" varchar(10) NOT NULL,
	"channel_id" varchar(30) NOT NULL,
	"user_id" varchar(30) NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activity_daily_guild_id_activity_date_channel_id_user_id_pk" PRIMARY KEY("guild_id","activity_date","channel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "birthdays" (
	"guild_id" varchar(30) NOT NULL,
	"user_id" varchar(30) NOT NULL,
	"month" integer NOT NULL,
	"day" integer NOT NULL,
	"last_announced_year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "birthdays_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"poll_id" uuid NOT NULL,
	"user_id" varchar(30) NOT NULL,
	"option_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_poll_id_user_id_pk" PRIMARY KEY("poll_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(30) NOT NULL,
	"channel_id" varchar(30) NOT NULL,
	"message_id" varchar(30),
	"created_by_id" varchar(30) NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"anonymous" boolean DEFAULT true NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "goodbye_channel_id" varchar(30);--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "birthday_channel_id" varchar(30);--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "welcome_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "goodbye_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "goodbye_message" text;--> statement-breakpoint
ALTER TABLE "activity_daily" ADD CONSTRAINT "activity_daily_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "birthdays" ADD CONSTRAINT "birthdays_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE no action ON UPDATE no action;