CREATE TABLE "app_setting" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text,
	CONSTRAINT "app_setting_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "app_setting" ADD CONSTRAINT "app_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;