-- The tag the server gives, on its own, to a ranked player who earns the Platina achievement. Additive: no schema change.
-- It goes last in priority (after whatever the admin has created), and the Primeiro Platinado tag is untouched.
INSERT INTO "player_tags" ("id", "label", "description", "color", "visibility", "single", "position")
SELECT 'platinado', '💎 Platinado', 'Conquistou todas as conquistas do jogo.', '#9be7ff', 'public', false, COALESCE(MAX("position"), -1) + 1
FROM "player_tags"
ON CONFLICT ("id") DO NOTHING;
