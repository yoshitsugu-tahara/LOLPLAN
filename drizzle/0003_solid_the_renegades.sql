CREATE TABLE "favorite_champion" (
	"user_id" text NOT NULL,
	"champion_id" text NOT NULL,
	CONSTRAINT "favorite_champion_user_id_champion_id_pk" PRIMARY KEY("user_id","champion_id")
);
--> statement-breakpoint
ALTER TABLE "favorite_champion" ADD CONSTRAINT "favorite_champion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;