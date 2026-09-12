ALTER TABLE "bingo_cards" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bingo_cards" ADD COLUMN "guild_id" varchar(30);--> statement-breakpoint
ALTER TABLE "bingo_cards" ADD COLUMN "title" varchar(100);--> statement-breakpoint
UPDATE "bingo_cards" AS card
SET "guild_id" = event."guild_id", "title" = event."title"
FROM "bingo_events" AS event
WHERE card."event_id" = event."id";--> statement-breakpoint
ALTER TABLE "bingo_cards" ALTER COLUMN "guild_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bingo_cards" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bingo_cards" ADD CONSTRAINT "bingo_cards_guild_id_guilds_guild_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bingo_cards_guild_creator_idx" ON "bingo_cards" USING btree ("guild_id","created_by_id");
