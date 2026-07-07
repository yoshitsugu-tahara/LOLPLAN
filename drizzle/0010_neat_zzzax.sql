CREATE TABLE "riot_rank" (
	"puuid" text PRIMARY KEY NOT NULL,
	"tier" text,
	"division" text,
	"lp" integer,
	"wins" integer,
	"losses" integer,
	"fetched_at" bigint NOT NULL
);
