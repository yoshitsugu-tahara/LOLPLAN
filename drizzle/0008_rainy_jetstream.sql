CREATE TABLE "riot_match" (
	"match_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
