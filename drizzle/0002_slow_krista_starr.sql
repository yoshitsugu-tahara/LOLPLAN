CREATE TABLE "focus" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"result" text NOT NULL,
	"champion" text,
	"role" text,
	"focus_score" text,
	"good" text,
	"mistake" text,
	"tags" text[],
	"next_focus" text,
	"played_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "focus" ADD CONSTRAINT "focus_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "focus_user_idx" ON "focus" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_user_idx" ON "game" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "game_user_played_idx" ON "game" USING btree ("user_id","played_at");