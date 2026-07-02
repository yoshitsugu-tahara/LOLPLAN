CREATE TABLE "image" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_user_idx" ON "image" USING btree ("user_id");