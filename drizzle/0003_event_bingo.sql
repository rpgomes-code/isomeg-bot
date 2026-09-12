CREATE TABLE "bingo_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"created_by_id" varchar(30) NOT NULL,
	"predictions" jsonb NOT NULL,
	"marks" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bingo_cards_event_creator_unique" UNIQUE("event_id","created_by_id"),
	CONSTRAINT "bingo_cards_predictions_check" CHECK (jsonb_typeof("bingo_cards"."predictions") = 'array' and jsonb_array_length("bingo_cards"."predictions") = 25),
	CONSTRAINT "bingo_cards_marks_check" CHECK ("bingo_cards"."marks" between 0 and 33554431)
);
--> statement-breakpoint
CREATE TABLE "bingo_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" varchar(30) NOT NULL,
	"created_by_id" varchar(30) NOT NULL,
	"title" varchar(100) NOT NULL,
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bingo_events_status_check" CHECK ("bingo_events"."status" in ('open', 'live', 'ended'))
);
--> statement-breakpoint
ALTER TABLE "bingo_cards" ADD CONSTRAINT "bingo_cards_event_id_bingo_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."bingo_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bingo_events" ADD CONSTRAINT "bingo_events_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bingo_events_guild_idx" ON "bingo_events" USING btree ("guild_id");