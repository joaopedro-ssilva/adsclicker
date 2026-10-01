# Brief: design system and UI kit (Codex)

You are the lead interface designer and front-end engineer of **ADSClicker**, a pixel-art clicker/idle game in Brazilian Portuguese. Read `docs/GAME_DESIGN.md` (section 8 and the skins/sceneries tables) and `docs/ARCHITECTURE.md` first.

This task builds the visual language and the reusable, presentational pieces. The game screens come in a later task, built on top of what you make here. The bar is high: the owner wants a design that impresses, with fabulous animation, while keeping the charm of a silly college game.

## You own

`src/ui/**` (except `src/ui/art/manifest.ts`, read-only), `src/app/**`.

Do not touch `src/game/**`, `package.json`, config files, `docs/**`, `public/assets/**` or `scripts/**`. Other agents are working there right now, in the same working tree. Do not run `git` commands that change state (no commit, stash, checkout, reset). Do not add dependencies: you have React 19, Tailwind 4, `motion` and what the browser gives you.

## Direction

- **Pixel art game, modern feel.** Dark base, chunky pixel frames (hard-edged borders and offset shadows, no blur, no rounded-corner softness), generous spacing, one saturated accent colour at a time. It should feel like a polished indie pixel game HUD, not a retro pastiche and not a SaaS dashboard.
- **Accent = the professor on stage.** Everything accent-coloured reads from `--accent` so the whole HUD re-tints when the player swaps professor. Professors' colours are in GAME_DESIGN section 2.
- **Themes are colour-only.** `ThemeDef.colors` (`src/game/content/types.ts`) maps to `--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`. Build every component on those variables so a theme swap needs no component change. Provide the default dark values in `globals.css`.
- **Type.** A pixel display font for titles and numbers plus a clean, highly legible font for dense text, both through `next/font/google`, both with full pt-BR coverage (ç ã õ é ê í ó ú). Numbers must use tabular figures.
- **Motion with weight.** Squash and stretch, overshoot, hard pixel steps where it suits (`steps()`), particles on a canvas. Every animation honours `prefers-reduced-motion` and a `reducedMotion` flag passed by context.
- **Sprites are pixel art.** `image-rendering: pixelated`, integer scale only.

## Deliverables

1. **Tokens and base** in `src/app/globals.css`: colour variables (theme + accent + rarity: common, rare, epic, legendary + good/warn/bad), spacing, pixel-border utilities, fonts wired in `src/app/layout.tsx`. A small `ThemeProvider`/helper that applies a `ThemeDef` and an accent colour by setting CSS variables on a wrapper element.
2. **Primitives** in `src/ui/kit/`: `Panel` (pixel frame), `Button` (variants: primary, secondary, ghost, danger; sizes; disabled; pressed animation), `IconButton`, `Tabs`, `ProgressBar` (with optional segmented/pixel look and a label), `Badge` and `RarityBadge`, `Tooltip`, `Modal` (focus trap, Esc, backdrop), `Toast` stack with an imperative `toast()` API, `NumberTicker` (animates between formatted values; takes the already formatted string plus a numeric hint for direction), `Meter` (radial or bar cooldown), `EmptyState`, `Keycap`. Accessible: real buttons, focus rings, aria labels.
3. **Icons** in `src/ui/kit/icons.tsx`: a small set of crisp pixel-style inline SVG icons used by the HUD (coin, diploma, click, clock, lock, check, star, sound on/off, music, settings, book, flask, trophy, shirt, image, palette, shield, cloud, rocket, crown, arrow up, plus, x). Game content also uses emoji inside names; that is intended.
4. **`Character`** in `src/ui/art/Character.tsx`: draws a professor as layered pixel sprites — body (skin), head, optional hat — using `ASSETS` from `src/ui/art/manifest.ts` for sizes and anchors (head chin sits on body neck; hat rests on head top). Chibi look: the head is large relative to the body. Props include body/head/hat asset keys, the skin `palette`, a `seed` string, a display `scale`, and an imperative or prop-driven `bump` to play the click squash. **When an asset key is not in `ASSETS`, draw a procedural pixel sprite instead** (canvas or SVG rects): a deterministic chibi body from the palette and a deterministic head (skin tone, hair style/colour, optional glasses/beard) from the seed. The fallback must look good on its own — the game may ship with it. Idle animation: gentle breathing bob in pixel steps.
5. **`Scenery`** in `src/ui/art/Scenery.tsx`: full-bleed background from `sceneries/<id>` when available, otherwise a procedural pixel backdrop from `SceneryDef.palette` (sky gradient in banded steps, horizon, floor). An ambient particle layer on canvas for each `Ambient` value (dust, rain, embers, stars, bubbles, code, leaves, confetti).
6. **`FxLayer`** in `src/ui/fx/`: one full-screen canvas with an imperative API for floating numbers (`+12,5 K`, bigger and shaking for crits, optional 👍), coin bursts that fly to a target element, sparkles/confetti bursts, and screen shake. Must stay smooth with hundreds of particles.
7. **Audio** in `src/ui/audio/`: WebAudio synthesised chiptune-style SFX with no audio files: `click`, `crit`, `buy`, `cantAfford`, `milestone`, `achievement`, `unlock`, `hire`, `invasionSpawn`, `invasionHit`, `invasionDefended`, `invasionMissed`, `ability`, `sprintDone`, `sprintFailed`, `graduate`, `uiTap`. A short looping chiptune background track generated by a tiny sequencer. API: `audio.play(name)`, `audio.setVolumes({ sfx, music, muted })`, `audio.setMusic(on)`. The audio context is created lazily on the first user gesture.
8. **Showcase route** `src/app/kit/page.tsx`: one page that shows every piece above in all states, with a professor/accent switcher, a theme switcher (invent 3 sample `ThemeDef`s locally), a few fallback `Character`s with different seeds and palettes next to each other, every `Ambient`, buttons that fire each FX and each sound. This page is how the work gets reviewed.
9. `src/app/page.tsx` stays a minimal placeholder that links to `/kit`.

## Constraints

- TypeScript strict, no `any`, no `@ts-ignore`. Client components where needed (`'use client'`); nothing may touch `window`, `document` or `AudioContext` at import time (Next renders on the server).
- Components are presentational: props in, callbacks out. No store, no game logic.
- UI text in pt-BR. Code, names and comments in English. Comments only for non-obvious "why".
- Finish with `npm run typecheck` and `npm run lint` clean for the files you own. Do not run `next build` (fonts need network).

## Report

End with a short report: the files you created, the design decisions you made (fonts, palette, frame style), the public API of `Character`, `Scenery`, `FxLayer`, `audio` and `toast`, and anything you could not finish.
