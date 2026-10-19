'use client';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { formatNumber } from '@/game/engine/format';
import { useCoins, useGame, useGameEvents, useGameState, useLabBenchView, useLabMonitorView, useLabTreeView } from '@/game/store';
import { IconButton, Keycap } from '@/ui/kit';
import { useUi } from '../shared/uiStore';
import { shortcutKey } from '../stage/shortcutList';
import { Equipment, Summary } from './Bench';
import { Cosmetics } from './Cosmetics';
import { FightNote } from './Decision';
import { LabUnlockDialog } from './LabEntry';
import { useLabOverlay } from './labOverlayStore';
import type { LabTab } from './labOverlayStore';
import { Monitor } from './Monitor';
import { Ranking } from './Ranking';
import { Shop } from './Shop';
import { Progression } from './Tree';
import { useLabFeed } from './useLabFeed';

const TABS: { id: LabTab; label: string; icon: string }[] = [
  { id: 'pesquisa', label: 'Pesquisa', icon: '🔬' },
  { id: 'progressao', label: 'Progressão', icon: '🌳' },
  { id: 'ranking', label: 'Ranking', icon: '🏆' },
  { id: 'cosmeticos', label: 'Cosméticos', icon: '🎨' },
];

/** The room the screens may grow to, and the least they shrink to before the body scrolls instead. */
const SCALE_MAX = 1.15;
const SCALE_MIN = 0.8;

/**
 * Sizes the Pesquisa and Progressão blocks (desktop): 15% larger when there is room, smaller when the window is short, so the
 * whole block stays in view. Sets --lab-scale on the body; the CSS zoom does the rest. The height depends on the width the
 * zoom leaves, so it settles over a few passes.
 */
function useFitScale(body: RefObject<HTMLDivElement | null>, tab: LabTab): void {
  useEffect(() => {
    const box = body.current;
    const content = box?.firstElementChild;
    if (!box || !(content instanceof HTMLElement)) return;
    const desktop = window.matchMedia('(min-width: 1200px)');
    let frame = 0;
    const fit = () => {
      frame = 0;
      if (!desktop.matches) {
        box.style.removeProperty('--lab-scale');
        return;
      }
      let scale = Number(box.style.getPropertyValue('--lab-scale')) || SCALE_MAX;
      for (let pass = 0; pass < 5; pass += 1) {
        box.style.setProperty('--lab-scale', String(scale));
        const rect = content.getBoundingClientRect();
        if (rect.height === 0 || rect.width === 0) return;
        const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale * Math.min(box.clientHeight / rect.height, box.clientWidth / rect.width)));
        if (Math.abs(next - scale) < 0.004) break;
        scale = next;
      }
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(fit);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(box);
    observer.observe(content);
    desktop.addEventListener('change', schedule);
    fit();
    return () => {
      observer.disconnect();
      desktop.removeEventListener('change', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [body, tab]);
}

const FOCUSABLE = 'button:not(:disabled), a[href], [tabindex="0"]';

/**
 * The contract with the game: the run only advances while the lab is open. The flag follows the overlay (on while it is
 * up and the page is visible, off when it closes, unmounts or the tab is hidden), and is put back if a graduation or an
 * imported save cleared it under an overlay that is still showing.
 */
function useLabOpenContract(): void {
  const open = useGameState((state) => state.lab.open);

  useEffect(() => {
    const sync = () => useGame.getState().setLabOpen(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      useGame.getState().setLabOpen(false);
    };
  }, []);

  useEffect(() => {
    if (!open && document.visibilityState === 'visible') useGame.getState().setLabOpen(true);
  }, [open]);
}

function CoinsStat() {
  const coins = useCoins();
  return <b>{formatNumber(coins, { integer: true })}</b>;
}

function Research() {
  const monitor = useLabMonitorView();
  const bench = useLabBenchView();
  const feed = useLabFeed();

  // Desktop: summary | monitor | equipment. The reward options and the equip choice are drawn on the monitor's glass, so
  // the grid never changes shape. Narrow screens stack them: monitor, summary, equipment (see the areas in lab.css).
  return (
    <div className="lab-grid">
      <Summary view={bench} />
      <Equipment view={bench} />
      <section className="lab-area-monitor lab-panel" aria-label="Pesquisa em andamento">
        <header className="lab-section-head">
          <h3>Pesquisa em andamento</h3>
        </header>
        <Monitor view={monitor} feed={feed} />
        <div className="lab-note-slot">{monitor.status === 'fighting' ? <FightNote view={monitor} /> : null}</div>
      </section>
    </div>
  );
}

function TopBar({ tab }: { tab: LabTab }) {
  const hide = useLabOverlay((store) => store.hide);
  const setTab = useLabOverlay((store) => store.setTab);
  const openShop = useLabOverlay((store) => store.openShop);
  const monitor = useLabMonitorView();
  const bench = useLabBenchView();

  return (
    <header className="lab-bar">
      <h2 className="lab-title">
        <span aria-hidden="true">🧪</span> Laboratório de Pesquisa
      </h2>
      <div role="tablist" aria-label="Seções do Laboratório" className="lab-tabs">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            data-qa={`lab-tab-${entry.id}`}
            onClick={() => setTab(entry.id)}
          >
            <span className="lab-tab-icon" aria-hidden="true">
              {entry.icon}
            </span>
            {entry.label}
          </button>
        ))}
      </div>
      <button type="button" className="lab-shop-button" aria-haspopup="dialog" onClick={openShop} data-qa="lab-shop-button">
        <span className="lab-tab-icon" aria-hidden="true">
          🛒
        </span>
        Loja
      </button>
      <div className="lab-stats" role="group" aria-label="Números do Laboratório">
        <dl className="lab-stat-group" aria-label="Pesquisa">
          <div data-qa="lab-stat-phase">
            <dt>Fase</dt>
            <dd>{monitor.hasRun ? monitor.phase : '-'}</dd>
          </div>
          <div data-qa="lab-stat-best">
            <dt>Recorde</dt>
            <dd>{monitor.bestPhase || '-'}</dd>
          </div>
        </dl>
        <dl className="lab-stat-group" aria-label="Recursos">
          <div data-qa="lab-stat-commits">
            <dt>Commits</dt>
            <dd>{formatNumber(monitor.wallet, { integer: true })}</dd>
          </div>
          <div data-qa="lab-stat-power">
            <dt>Poder</dt>
            <dd>{formatNumber(bench.power)}</dd>
          </div>
          <div data-qa="lab-stat-coins">
            <dt>ADScoins</dt>
            <dd>
              <CoinsStat />
            </dd>
          </div>
        </dl>
      </div>
      <IconButton icon="x" label="Fechar o Laboratório (Esc)" variant="secondary" size="sm" onClick={hide} data-qa="lab-close" />
    </header>
  );
}

/**
 * The Laboratório, full screen over the classroom. It is not a route and not a modal: the clicker keeps ticking underneath
 * (the coins in the top bar move), and the keys belong to it while it is up. Esc and the X close it.
 */
export function LabOverlay() {
  const root = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tab = useLabOverlay((store) => store.tab);
  const hide = useLabOverlay((store) => store.hide);
  const tree = useLabTreeView();
  const theme = useGameState((state) => state.lab.cosmetics.theme);
  useLabOpenContract();
  useFitScale(bodyRef, tab);
  // The graduation scene takes the screen: the lab (its run, its items) is reset under it.
  useGameEvents(() => hide(), ['graduate']);

  useEffect(() => {
    const node = root.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // A window on top of the lab (a ceremony) owns Esc.
        if (useLabOverlay.getState().shopOpen) return; // the shop panel owns this Esc
        // (the overlay is itself a modal dialog and comes first in the document, so look for any other one)
        const other = Array.from(document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')).some((entry) => entry !== node);
        if (other) return;
        event.preventDefault();
        hide();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      if (document.querySelector('dialog[open]')) return; // a native dialog (the player profile) traps its own Tab
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [hide]);

  return (
    <div ref={root} className="lab" role="dialog" aria-modal="true" aria-label="Laboratório de Pesquisa" tabIndex={-1} data-lab-theme={theme} data-qa="lab-overlay">
      <TopBar tab={tab} />
      <div ref={bodyRef} className="lab-body">
        {tab === 'pesquisa' ? <Research /> : null}
        {tab === 'progressao' ? <Progression view={tree} /> : null}
        {tab === 'ranking' ? <Ranking /> : null}
        {tab === 'cosmeticos' ? <Cosmetics /> : null}
      </div>
      <Shop />
      <p className="lab-foot" aria-hidden="true">
        <Keycap>{shortcutKey('lab')}</Keycap> abre · <Keycap>Esc</Keycap> fecha
      </p>
    </div>
  );
}

/** Mounted once by the game screen: the overlay while it is shown, and the unlock confirmation. */
export function LabHost() {
  const shown = useLabOverlay((store) => store.shown);
  const unlocked = useGameState((state) => state.lab.unlocked);
  const photo = useUi((store) => store.photo);
  return (
    <>
      {shown && unlocked && !photo ? <LabOverlay /> : null}
      <LabUnlockDialog />
    </>
  );
}
