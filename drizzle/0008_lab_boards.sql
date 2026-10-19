ALTER TABLE "players" ADD COLUMN "lab_best_phase" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "lab_best_phase_build" jsonb;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "lab_best_phase_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "best_run_coins_text" text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "best_run_coins_log" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "best_run_build" jsonb;--> statement-breakpoint
CREATE INDEX "players_board_lab_phase_idx" ON "players" USING btree ("lab_best_phase" DESC NULLS LAST,"lab_best_phase_at","id") WHERE "players"."nickname" is not null and not "players"."flagged" and not "players"."banned" and not "players"."test_account" and "players"."lab_best_phase" > 0;--> statement-breakpoint
CREATE INDEX "players_board_best_run_idx" ON "players" USING btree ("best_run_coins_log" DESC NULLS LAST,"id") WHERE "players"."nickname" is not null and not "players"."flagged" and not "players"."banned" and not "players"."test_account" and "players"."best_run_coins_log" > 0;