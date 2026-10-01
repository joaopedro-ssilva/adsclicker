# Brief: the game screens (Codex)

You built the design system and kit of **ADSClicker** (`src/ui/kit`, `src/ui/art`, `src/ui/fx`, `src/ui/audio`, showcase at `/kit`). The engine, the store and the content now exist. This task builds the actual game on `/` with them.

Read `docs/GAME_DESIGN.md`, `docs/ARCHITECTURE.md`, `src/game/store/types.ts` (actions, events, view models) and the API notes at the end of this brief.

## You own

`src/ui/**` (except `src/ui/art/manifest.ts`, generated) and `src/app/**`. Do not touch `src/game/**`, `package.json`, config, `docs/**`, `scripts/**`, `public/**`. Do not run git commands that change state. No new dependencies. If the engine or store lacks something you need, do not edit it: work around it and list it in your report.

## The screen

Desktop (≥ 1024 px): the **stage** on the left takes the remaining width; a **panel** about 460–500 px wide on the right. Mobile: stage on top (about 48 dvh), panel below with its tabs reachable by thumb. No horizontal scroll at 390 px.

The HUD accent follows the professor on stage; the equipped `ThemeDef` sets the base colours (kit theme helper).

### Stage
- `Scenery` of the equipped scenery, full-bleed.
- Top: the logo "ADSClicker" (10 quick clicks fire `triggerSecret('logo-clicks')`), sound toggle and settings shortcut.
- The balance: coin icon and a large `NumberTicker`, with "por clique" and "por segundo" under it.
- The **professor on stage**: `Character` with the equipped skin and that professor's head (`heads/<professorId>`), big, centred, standing on the scenery floor. Clicking it calls `click(x, y)`. It is the heart of the game: squash on every click, floating number at the pointer (bigger, shaking and with 👍 on a crit), coin burst flying to the balance, screen shake on crits, sound. Mark it `data-qa="clicker"`. Keyboard: Space/Enter clicks too.
- A speech bubble that now and then shows one of the professor's `quotes` (click lines while clicking, idle lines when quiet, milestone lines on milestones).
- **Combo meter** near the character: steps out of max and the current multiplier, heating up visually as it fills.
- **Buff chips**: active buffs with emoji, name and time left.
- **Abilities** (feature `abilities` or any unlocked ability): buttons with cooldown meters; pressing one calls `useAbility`.
- **Invasion** (feature `events`): the threat appears at its `x`,`y` on the stage with its emoji, a shrinking timer ring and the clicks left; clicking it calls `hitInvasion()`. Clear feedback for hit, defended (reward shown) and missed.
- **Sprint** (feature `sprints`): a compact card — three offers to pick from, or the active sprint's goal, progress bar and countdown, or the wait until the next offers.
- **Roster** along the bottom of the stage: one portrait per professor in hire order. Hired: click to put on stage. The next one to hire: shows cost, progress towards it and a hire button. Further ones: locked silhouettes with "???".

### Panel tabs
1. **Aulas**: a strip to pick which hired professor's tree to look at (defaults to the one on stage). For that professor: the three disciplines and their click upgrades as cards built from `LevelledView` — emoji, name, level, current output, what the next purchase adds, cost, a buy button that is obviously enabled/disabled, and the progress bar to the next milestone. Locked items show as "???" with the lock reason, like the original game. The x1 / x10 / máx selector appears with the `bulkBuy` feature. Holding the buy button repeats the purchase.
2. **Pesquisas**: the visible research as cards (emoji, name, what it does, cost, buy). Bought ones collapse into a "concluídas" section. A dot on the tab when something is affordable.
3. **Álbum**: four sections — Skins (grouped by professor; owned ones can be equipped; locked ones are dark silhouettes named "???" with the hint of the achievement that grants them; rarity frame), Cenários, Temas (only with the `hudThemes` feature) and Conquistas (grouped by family, with progress bars, unlock dates, the total count and the production bonus they add; secret ones stay "???").
4. **Formatura** (appears with the `graduation` feature or once any diploma was earned): what a graduation would give right now, the progress to the next diploma, what resets and what stays, a graduate button with a confirmation step, and the **prestige tree** drawn from each node's `position` with connectors, levels and costs, bought with `buyPrestigeNode`.
5. **Config**: volumes and mute, music on/off, reduced motion, floating numbers, statistics (the counters, readable), export save (copy and download), import save (paste or file), reset with a typed confirmation, version and credits ("Remaster do Edécio Clicker, 2023").

### Moments
- **Offline report** modal on boot when `offlineReport` is set.
- **Achievement** toast with emoji, name and what it granted.
- **Skin / scenery / theme unlock** ceremony scaled by rarity: common is a quick card, legendary takes the whole screen with particles. Offer "equipar agora".
- **Hire** scene: full-screen entrance of the new professor with their accent colour, hire quote and the layer they bring ("Agora você tem: Invasões").
- **Graduation** scene: full-screen, diplomas counted up, confetti.
- First minutes: a very light nudge ("Clique no professor") that disappears after the first clicks. No tutorial walls.

### Wiring
- One component subscribes to `useGameEvents` and turns `GameEvent`s into FX, sounds and toasts. Audio volumes follow `state.settings`.
- Secrets fired from the UI with `triggerSecret`: `logo-clicks`, `konami` (↑↑↓↓←→←→BA), `night-owl` (playing between 3:00 and 5:00 local time), `swap-spree` (20 professor swaps within a minute), `idle-watcher` (a minute with the game open and no click), `joinha` (typing "muito legal").
- Render nothing game-related until `ready` is true (show a small pixel loading state), to avoid hydration mismatches.
- Views are rebuilt up to 10 times a second: keep lists memoised and avoid re-rendering the whole tree on every tick.

### Testing hooks
Add `data-qa` attributes: `clicker`, `balance`, `tab-<aulas|pesquisas|album|formatura|config>`, `buy-<id>`, `research-<id>`, `hire-<professorId>`, `roster-<professorId>`.

## Quality bar
This is the part the owner will judge: it has to look and feel great, in the pixel-art language of the kit. Strict TypeScript, no `any`. pt-BR text. `npm run typecheck` and `npm run lint` clean. Do not run `next build`.

## Report
Files created; what is wired and what is not; anything missing from the engine/store/content that you worked around.

## API notes
