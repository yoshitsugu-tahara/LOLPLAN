CREATE TABLE "oauth_client" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"redirect_uris" text[] NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_code" (
	"code" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text NOT NULL,
	"resource" text,
	"scope" text,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_token" (
	"token" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"resource" text,
	"scope" text,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_code" ADD CONSTRAINT "oauth_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;