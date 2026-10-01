# Brief: the game screens

The design system and kit of **ADSClicker** exist (`src/ui/kit`, `src/ui/art`, `src/ui/fx`, `src/ui/audio`, showcase at `/kit`), and so do the engine, the store and the content. This brief describes the actual game on `/`, built with them.

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

### Store and engine (import from `@/game/store`)

- `useGame` is a Zustand hook implementing `GameStore` (`src/game/store/types.ts`). Call `useGame.getState().boot()` from a client effect (idempotent, StrictMode-safe) and render the game only when `useGame(s => s.ready)` is true. Actions: `useGame(s => s.click)` and so on, exactly the `GameActions` interface.
- `state` is an immutable snapshot: never mutate it. Each mutation publishes a new top-level reference; unchanged nested objects keep their reference, so `useGameState(s => s.levels)` only re-renders when that data changes.
- Hooks: `useGameState(selector)`, `useGameStateShallow(selector)` (for selectors returning fresh objects), `useGameView(build)` (`build` must be a stable reference), `useCoins()`, `useCoinsPerSecond()`, `useClickValue()`, `useStats()`, `useCombo()`, `useDisciplineViews()`, `useClickUpgradeViews()`, `useResearchViews()`, `useProfessorViews()`, `useAbilityViews()`, `usePrestigeNodeViews()`, `useGraduationPreview()`, `useAchievementViews()`, `useHasFeature(feature)`, `useActiveProfessor()`, `useGameEvents(handler, types?)` (the handler may be inline; events arrive after the new state is published).
- `content` (the whole `GameContent`) is exported from `@/game/store` and from `@/game/content`.
- Pure builders in `@/game/engine/views`, all `(state, content)`: `coinsPerSecond`, `clickValue` (before combo and crit), `comboInfo`, `statsOf`, `hasFeature`, `effectiveBuyAmount`, `disciplineViews`, `clickUpgradeViews`, `levelledView(state, content, id)`, `researchViews`, `professorViews`, `abilityViews(state, content, now?)`, `prestigeNodeViews`, `graduationPreview`, `achievementViews`.
- Formatting in `@/game/engine/format`: `formatNumber(value, { integer?, digits? })` (`1.234`, `12,5 K`, `3,21 M` ... `1,23e36`), `formatDuration(ms)` (`2 h 05 min`, `45 s`), `formatPercent(fraction, decimals?)`.
- Things to know: auto clicks emit `click` events with `auto: true` (keep their feedback subtle); an ability's button shows when its `AbilityView.unlocked` is true; themes can be owned before the `hudThemes` feature exists (the Temas section only appears with the feature); cosmetics data (skins, sceneries, themes, achievements and which achievement rewards what) comes from `content`, ownership from `state.skins`, `state.sceneries`, `state.themes`, `state.achievements`.

### UI kit

Live showcase of everything: `/kit` (source in `src/app/kit/`, a good place to copy usage from).

**Tokens** (`src/ui/styles/tokens.css`): theme `--bg --surface --surface-raised --border --text --text-muted`; accent `--accent --on-accent --accent-text --accent-soft`; rarity `--common --rare --epic --legendary`; status `--good --warn --bad --on-bad`; spacing `--space-1…8` (4, 8, 12, 16, 24, 32, 48, 64 px); pixel frame `--pixel --shadow --shadow-color` and the `.pixel-frame` class (2 px border + 4 px offset shadow); fonts `--font-display` (Silkscreen: titles, numbers and short labels only — it has no lowercase and tires in long text) and `--font-text` (Nunito Sans: all running text); layers `--z-popover --z-fx --z-toast`; helper classes `.eyebrow .muted .sr-only .display`. Tailwind is available. Every animation must honour `prefers-reduced-motion` and the `[data-reduced-motion=true]` ancestor set by `ThemeProvider`. Derived CSS variables must be declared where their inputs live (a variable defined on `:root` from one set on a descendant resolves to nothing).

**Styles**: one CSS file beside each component. `src/app/globals.css` already imports three index files — `src/ui/game/stage/stage.css`, `src/ui/game/moments/moments.css`, `src/ui/game/panel/panel.css` — import your component CSS from the index you own. Do not edit `globals.css`.

**ThemeProvider**
```tsx
import { ThemeProvider, useReducedMotion, themeVariables } from '@/ui/ThemeProvider';
import { cssVariables } from '@/ui/theme';            // cssVariables({ '--x': 'y' }) → typed inline style
import { useMediaQuery } from '@/ui/useMediaQuery';   // (query: string) => boolean, false on the server
// <ThemeProvider theme={ThemeDef} accent={professor.color} reducedMotion={boolean}>…</ThemeProvider>
// themeVariables(theme?, accent?) returns the same variables as a style object, to tint one element (e.g. a professor's card) with another accent.
```

**Primitives** (`import { … } from '@/ui/kit'`)
- `Panel({ tone?: 'default'|'raised'|'inset', ...div props })`
- `Button({ variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md'|'lg', ...button props })` (`aria-pressed` for toggles)
- `IconButton({ icon: IconName, label: string, ...ButtonProps })`
- `Icon({ name: IconName, size?: number /* multiple of 12, default 24 */, title? })`; names: coin diploma click clock lock check star soundOn soundOff music settings book flask trophy shirt image palette shield cloud rocket crown arrowUp plus x
- `Badge({ tone?: 'neutral'|'accent'|'good'|'warn'|'bad' })`, `RarityBadge({ rarity })`, `Keycap`
- `EmptyState({ title, children?, action?, icon? })`
- `Tooltip({ content: string, placement?: 'top'|'bottom', children /* one focusable element */ })`
- `ProgressBar({ value, max?=100, label?, ariaLabel?, valueLabel?, segmented?, segments?=20, tone?: 'accent'|'good'|'warn'|'bad', size?: 'sm'|'md' })`
- `Meter({ value, max?=100, label, variant?: 'radial'|'bar', size?: 'sm'|'md'|'lg', children? /* centre content, e.g. an emoji */, showLabel?=true })`
- `NumberTicker({ value: string /* already formatted */, numericHint: number /* only the direction of change matters */, className? })`
- `Tabs({ items: TabItem[], value, onChange, label?, keepMounted? })` with `TabItem = { value, label, content, disabled?, dot?: boolean, testId?: string /* renders data-qa */ }`
- `Modal({ open, onClose, title, children, footer?, size?: 'sm'|'md'|'lg', dismissible? })` (native `<dialog>`, focus trap, Esc)
- `ToastStack()` mounted once, and `toast('texto')` or `toast({ title, description?, tone?: 'good'|'warn'|'bad'|'neutral', emoji?, duration? /* ms, default 4500, 0 = sticky */ })`, `toast.dismiss(id)`, `toast.clear()`

**Character** (`import { Character } from '@/ui/art/Character'`)
```tsx
// props: body?, head?, hat? (asset keys: 'skins/edecio-default', 'heads/edecio', 'hats/edecio-samurai'), palette, seed,
//        scale? (integer ≥ 1, default 3; a composed professor is about 47×105 native px, so ×3 ≈ 315 px tall),
//        bump? (change the number to play the click squash), idle? (default true), shadow? (default true), label?, className?
// Missing art falls back to a procedural sprite automatically. It is not a button: wrap it in <button data-qa="clicker">.
import { characterSprite } from '@/ui/game/shared/characterProps';
<Character {...characterSprite(professorId, equippedSkinId)} scale={4} bump={clickCount} />
```

**Scenery** (`import { Scenery } from '@/ui/art/Scenery'`): `<Scenery scenery={SceneryDef} focusY={0.65}>children drawn above art and particles</Scenery>`. It fills its container (give it a height or a flex size); the art is integer-scaled "cover".

**FxLayer** (`import { FxLayer, fx } from '@/ui/fx'`; mount `<FxLayer />` once, outside any transformed element; coordinates are viewport px, i.e. `event.clientX/clientY`)
```ts
fx.floatingNumber({ x, y, text: '+12,5 K', crit?: boolean, thumbsUp?: boolean, color?: string })
fx.coins({ x, y, target: HTMLElement, count?: number, color?: string, onArrive?: () => void })  // burst, then fly to the target, which pops
fx.sparkles({ x, y, count?, color? })
fx.confetti({ x, y, count?, color? })
fx.shake({ target?: HTMLElement, intensity?: number /* px, default 6 */, duration?: number /* ms, default 320 */ })
fx.clear()
```
Shake's default target is the element with `data-shake-root` (the game root has it). Never shake an ancestor of `<FxLayer />`. With reduced motion the effects are skipped by the layer itself.

**Audio** (`import { audio } from '@/ui/audio'`): `audio.play(name)` with names `click crit buy cantAfford milestone achievement unlock hire invasionSpawn invasionHit invasionDefended invasionMissed ability sprintDone sprintFailed graduate uiTap`; `audio.setVolumes({ sfx?, music?, muted? })` (0..1); `audio.setMusic(on)`. Silent until the first user gesture. Wire volumes to `state.settings`.

### Shared between stage and panel (`src/ui/game/shared/`, already written)
- `useUi` (`uiStore.ts`): `tab`, `setTab(tab)`, `albumSection`, `openAlbum(section)`, `treeProfessor`, `setTreeProfessor(id | null)`. The stage uses it to open a panel tab (settings shortcut, "equipar agora", "ver árvore").
- `characterSprite(professorId, skinId?)`, `skinById(id)`, `defaultSkinOf(professorId)` (`characterProps.ts`).

