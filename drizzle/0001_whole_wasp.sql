CREATE TABLE "hackathon_collection" (
	"player_id" uuid NOT NULL,
	"base" text NOT NULL,
	"found_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hackathon_collection_player_id_base_pk" PRIMARY KEY("player_id","base")
);
--> statement-breakpoint
CREATE TABLE "hackathon_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"base" text NOT NULL,
	"rarity" text NOT NULL,
	"level" integer NOT NULL,
	"affixes" jsonb NOT NULL,
	"quality" double precision NOT NULL,
	"rerolls" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hackathon_profiles" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"head" text NOT NULL,
	"cargo" text DEFAULT 'estudante' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" bigint DEFAULT 0 NOT NULL,
	"commits" bigint DEFAULT 0 NOT NULL,
	"cafe_count" integer DEFAULT 0 NOT NULL,
	"cafe_at" timestamp with time zone DEFAULT now() NOT NULL,
	"skill_nodes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mentors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"equipped" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pity" integer DEFAULT 0 NOT NULL,
	"victories" integer DEFAULT 0 NOT NULL,
	"defeats" integer DEFAULT 0 NOT NULL,
	"items_found" integer DEFAULT 0 NOT NULL,
	"legendaries" integer DEFAULT 0 NOT NULL,
	"cafes_bought_credited" integer DEFAULT 0 NOT NULL,
	"graduations_credited" integer DEFAULT 0 NOT NULL,
	"credit_day" text DEFAULT '' NOT NULL,
	"cafes_credited_today" integer DEFAULT 0 NOT NULL,
	"graduations_credited_today" integer DEFAULT 0 NOT NULL,
	"daily_day" text DEFAULT '' NOT NULL,
	"daily_clears" integer DEFAULT 0 NOT NULL,
	"best_item_base" text,
	"best_item_rarity" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hackathon_profiles_commits_nonneg" CHECK ("hackathon_profiles"."commits" >= 0),
	CONSTRAINT "hackathon_profiles_xp_nonneg" CHECK ("hackathon_profiles"."xp" >= 0),
	CONSTRAINT "hackathon_profiles_cafe_nonneg" CHECK ("hackathon_profiles"."cafe_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hackathon_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"stage_id" text NOT NULL,
	"seed" bigint NOT NULL,
	"auto" boolean NOT NULL,
	"build" jsonb NOT NULL,
	"stage" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hackathon_stages" (
	"player_id" uuid NOT NULL,
	"stage_id" text NOT NULL,
	"clears" integer DEFAULT 0 NOT NULL,
	"first_clear_at" timestamp with time zone,
	CONSTRAINT "hackathon_stages_player_id_stage_id_pk" PRIMARY KEY("player_id","stage_id")
);
--> statement-breakpoint
ALTER TABLE "hackathon_collection" ADD CONSTRAINT "hackathon_collection_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hackathon_items" ADD CONSTRAINT "hackathon_items_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hackathon_profiles" ADD CONSTRAINT "hackathon_profiles_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hackathon_runs" ADD CONSTRAINT "hackathon_runs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hackathon_stages" ADD CONSTRAINT "hackathon_stages_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hackathon_items_player_idx" ON "hackathon_items" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hackathon_runs_open_uq" ON "hackathon_runs" USING btree ("player_id") WHERE "hackathon_runs"."status" = 'open';--> statement-breakpoint
CREATE INDEX "hackathon_runs_player_idx" ON "hackathon_runs" USING btree ("player_id","started_at" DESC NULLS LAST);