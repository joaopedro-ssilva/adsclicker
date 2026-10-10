CREATE TABLE "server_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "server_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"player_id" uuid,
	"nickname" text,
	"route" text,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "traffic_hourly" (
	"hour" timestamp with time zone PRIMARY KEY NOT NULL,
	"syncs_accepted" integer DEFAULT 0 NOT NULL,
	"syncs_rejected" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_hourly_players" (
	"hour" timestamp with time zone NOT NULL,
	"player_id" uuid NOT NULL,
	CONSTRAINT "traffic_hourly_players_hour_player_id_pk" PRIMARY KEY("hour","player_id")
);
--> statement-breakpoint
CREATE INDEX "server_logs_at_idx" ON "server_logs" USING btree ("at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "server_logs_level_at_idx" ON "server_logs" USING btree ("level","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "server_logs_kind_at_idx" ON "server_logs" USING btree ("kind","at" DESC NULLS LAST);