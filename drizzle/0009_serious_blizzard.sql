CREATE TABLE "riot_match_player" (
	"puuid" text NOT NULL,
	"match_id" text NOT NULL,
	"champ" text,
	"win" boolean,
	"queue_id" integer,
	"game_start" bigint,
	"duration" integer,
	CONSTRAINT "riot_match_player_puuid_match_id_pk" PRIMARY KEY("puuid","match_id")
);
--> statement-breakpoint
CREATE INDEX "rmp_puuid_start_idx" ON "riot_match_player" USING btree ("puuid","game_start");