ALTER TABLE "players" ADD COLUMN "titles" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "progress_epoch" integer DEFAULT 0 NOT NULL;