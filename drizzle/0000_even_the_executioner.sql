CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" text,
	"nickname_key" text,
	"password_hash" text,
	"save" text,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifetime_coins_text" text DEFAULT '0' NOT NULL,
	"lifetime_coins" numeric DEFAULT '0' NOT NULL,
	"lifetime_coins_log" double precision DEFAULT 0 NOT NULL,
	"diplomas_earned" integer DEFAULT 0 NOT NULL,
	"graduations" integer DEFAULT 0 NOT NULL,
	"clicks" bigint DEFAULT 0 NOT NULL,
	"achievements" integer DEFAULT 0 NOT NULL,
	"professors" integer DEFAULT 1 NOT NULL,
	"play_seconds" bigint DEFAULT 0 NOT NULL,
	"avatar_professor" text DEFAULT 'edecio' NOT NULL,
	"avatar_skin" text DEFAULT '' NOT NULL,
	"multiplier" double precision DEFAULT 1 NOT NULL,
	"test_account" boolean DEFAULT false NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"banned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_events_once_uq" ON "feed_events" USING btree ("player_id","kind","detail");--> statement-breakpoint
CREATE INDEX "feed_events_created_idx" ON "feed_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "players_nickname_key_uq" ON "players" USING btree ("nickname_key");--> statement-breakpoint
CREATE INDEX "players_last_seen_idx" ON "players" USING btree ("last_seen_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "players_board_coins_idx" ON "players" USING btree ("lifetime_coins_log" DESC NULLS LAST,"id") WHERE "players"."nickname" is not null and not "players"."flagged" and not "players"."banned" and not "players"."test_account";--> statement-breakpoint
CREATE INDEX "players_board_diplomas_idx" ON "players" USING btree ("diplomas_earned" DESC NULLS LAST,"id") WHERE "players"."nickname" is not null and not "players"."flagged" and not "players"."banned" and not "players"."test_account";--> statement-breakpoint
CREATE INDEX "players_board_achievements_idx" ON "players" USING btree ("achievements" DESC NULLS LAST,"id") WHERE "players"."nickname" is not null and not "players"."flagged" and not "players"."banned" and not "players"."test_account";--> statement-breakpoint
CREATE INDEX "players_board_clicks_idx" ON "players" USING btree ("clicks" DESC NULLS LAST,"id") WHERE "players"."nickname" is not null and not "players"."flagged" and not "players"."banned" and not "players"."test_account";--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "sessions_player_idx" ON "sessions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");