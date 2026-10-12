CREATE TABLE "player_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"single" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_tags_visibility" CHECK ("player_tags"."visibility" in ('public', 'admin'))
);
--> statement-breakpoint
-- The two titles that used to live in code become ordinary tags, with the same ids (players already hold them).
INSERT INTO "player_tags" ("id", "label", "description", "color", "visibility", "single", "position") VALUES
	('primeiro-platinado', 'Primeiro Platinado', 'O primeiro jogador a conquistar todas as conquistas.', '#f2c744', 'public', true, 0),
	('turma-zero', 'Turma Zero', 'Jogou na fase de testes, antes do lançamento oficial.', '#6fd6e6', 'public', false, 1)
ON CONFLICT ("id") DO NOTHING;
