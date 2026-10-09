# Diploma cap, Maestrias and Monitores

Design agreed with the owner on 2026-10-08. Interface names are in Portuguese; code names in English (`maestria` may stay as a domain word, like `Domínio` did).

## The problem

Players reported that it pays to sit on a run instead of graduating: diplomas are `sqrt(runCoins / 2e19)` with no limit, and production accelerates inside a run. The tree costs 1,890 diplomas in total and the passive bonus (1% per diploma earned) stops at +100%, so late diplomas have nowhere to go.

## 1. Diploma cap per run

- A run can yield at most `10 × 2^graduations` diplomas (10 on the first, 20, 40...), where `graduations` is the number already done. Bonus sources that say "outside the cap" add after it.
- The Formatura tab shows the cap ("8/10 diplomas desta turma") and, at the cap, tells the player to graduate to raise the limit. Coins past the cap count for nothing.
- Tune the constants with the simulator so the first graduation takes about what it takes today, and report before/after.
- Check a suspected bug while there: with 5,000 diplomas the Formatura tab shows "+5.000%" production bonus, but `diplomaBonus` in `engine/stats.ts` caps at `maxBonus` (+100%). Find out which is wrong and fix it.

## 2. Maestrias

One special mechanic per professor: you pay once, it works by itself, and whoever wants depth finds it.

**Unlocking.** All eight are visible in the Formatura tab after the first graduation, with their description. Each graduation gives one Maestria slot; the player chooses which professor gets it (no fixed order: the choice is meant to feel important). Once unlocked, a Maestria has 5 levels bought with diplomas; level 1 comes with the slot. Level costs grow steeply: the eight maxed should cost several times the whole tree, so diplomas keep a purpose. Saves that already have graduations get their slots.

**First wave (build these):**

| Professor | Maestria | Rule | Levels |
| --- | --- | --- | --- |
| Edécio | Joinha de Ouro | A full click combo triggers a golden mode by itself (no button): for a few seconds every hand click is worth several times more and the combo does not fall, then a recharge before a full combo can trigger it again. Automatic clicks are not affected. (Redesigned on 2026-10-09: the old "every N clicks a golden click" was nearly Rollforward.) | Longer mode (8 → 20 s), bigger multiplier (x2 → x3), shorter recharge (150 → 90 s), hold the mouse to click about 10 times per second (level 5). Average gain at level 5 for someone clicking 10 times a second: +36% of click income |
| Gladimir | Rollforward | A charge fills with manual clicks (about 300). When full, a button jumps the game forward: the coins of that period arrive at once, and every recharge timer advances by the same amount (ability cooldowns, the next sprint offer, the next invasion, the Super invasão charge, Guto's Maestria). Running countdowns (an active sprint, an invasion on screen, an active buff) are never touched. The joke: in databases a rollforward replays the log to move the database forward in time | Longer jump (5 min → 60 min), a second stored charge (level 3), a third (level 5) |
| Wagner | Super invasão | Charges once per hour of real time (one stored charge). The player chooses when to fire it. For about 45 s a swarm of bugs takes over the stage, each dying after a few clicks, and a boss arrives near the end. Reward grows with how many were defeated, with a bonus for clearing all. Reuse the Hackathon enemy sprites in `public/assets/hackathon/enemies` (bug, loop-infinito, vazamento-de-memoria, codigo-legado, conflito-de-merge, bug-de-merge; `deploy-de-sexta` is the boss) | A firewall that kills bugs by itself, faster each level (for players who do not want to worry), bigger reward, shorter charge (60 → 30 min) |

Rewards are measured in seconds of production so they scale with the save, and they must be bounded so the server's plausibility check (`src/server/players/plausibility.ts`) can account for them.

**Second wave (built; the numbers live in `content/maestrias.ts`, the rules in GAME_DESIGN):**

- Bruna B2, Design System: buying a level gives free levels only in classes whose next level costs less than what was just paid (it only flows down to cheaper classes).
- Guto, Festa de lançamento: a long-cooldown button (about 30 min) that makes one minute of chaos: every ability fires at once, everything is boosted, invasions come more often and abilities recharge faster while it lasts.
- Bruna B1, Releases: every 5 sprints completed ship a version worth +3% production until the end of the run, at most 10 versions; levels raise it to +5% each, never the limit.
- Angelo, Horas complementares: everything done in the run counts hours; each band filled gives one extra diploma at graduation, outside the cap.
- Pablo, Bolsa de tokens: assets whose price moves over time, bought with coins and sold later, plus a slow safe fund; the amount invested is limited to minutes of production.

Build the framework so these five drop in without reworking it.

## 3. Monitores

Students who automate a chore, hired with diplomas after the first graduation, each with an on/off switch:

- Monitor de Compras: buys the best affordable class level every few seconds.
- Monitor de Segurança: defends an invasion by itself after a short delay, for part of the reward.
- Monitor de Sprints: accepts a sprint offer by itself (completing it is still up to the player).
- Monitor de Pesquisa: buys a research when it can be afforded.

Levels make each one faster or better. They must not trivialise the achievements that ask the player to do the thing by hand; say in the report how each interacts.
