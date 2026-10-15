'use client';
import { useEffect, useRef } from 'react';
import { formatNumber } from '@/game/engine/format';
import { useCoins, useGame, useGameEvents, useGameState, useLabBenchView, useLabMonitorView, useLabRewardsView, useLabTreeView } from '@/game/store';
import { IconButton, Keycap } from '@/ui/kit';
import { useUi } from '../shared/uiStore';
import { shortcutKey } from '../stage/shortcutList';
import { Bench } from './Bench';
import { Compare, FightNote, Rewards } from './Decision';
import { LabUnlockDialog } from './LabEntry';
import { useLabOverlay } from './labOverlayStore';
import type { LabTab } from './labOverlayStore';
import { Monitor } from './Monitor';
import { Records, Tree } from './Tree';
import { useLabFeed } from './useLabFeed';

const TABS: { id: LabTab; label: string }[] = [
  { id: 'pesquisa', label: 'Pesquisa' },
  { id: 'arvore', label: 'Árvore' },
  { id: 'registro', label: 'Registro' },
];

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
  const rewards = useLabRewardsView();
  const feed = useLabFeed();

  return (
    <div className="lab-grid">
      <div className="lab-main">
        <Monitor view={monitor} feed={feed} />
        {rewards.open ? <Rewards view={rewards} /> : null}
        {monitor.status === 'equip' && bench.pending ? <Compare pending={bench.pending} /> : null}
        {monitor.status === 'fighting' ? <FightNote view={monitor} /> : null}
      </div>
      <aside className="lab-side">
        <Bench view={bench} />
      </aside>
    </div>
  );
}

function TopBar({ tab }: { tab: LabTab }) {
  const hide = useLabOverlay((store) => store.hide);
  const setTab = useLabOverlay((store) => store.setTab);
  const monitor = useLabMonitorView();
  const bench = useLabBenchView();

  return (
    <header className="lab-bar">
      <div className="lab-bar-title">
        <h2>Laboratório de Pesquisa</h2>
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
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <dl className="lab-stats">
        <div data-qa="lab-stat-phase">
          <dt>Fase</dt>
          <dd>{monitor.hasRun ? monitor.phase : '-'}</dd>
        </div>
        <div data-qa="lab-stat-best">
          <dt>Recorde</dt>
          <dd>{monitor.bestPhase || '-'}</dd>
        </div>
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
  const tab = useLabOverlay((store) => store.tab);
  const hide = useLabOverlay((store) => store.hide);
  const tree = useLabTreeView();
  useLabOpenContract();
  // The graduation scene takes the screen: the lab (its run, its items) is reset under it.
  useGameEvents(() => hide(), ['graduate']);

  useEffect(() => {
    const node = root.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // A window on top of the lab (a ceremony) owns Esc.
        const other = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
        if (other && other !== node) return;
        event.preventDefault();
        hide();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
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
    <div ref={root} className="lab" role="dialog" aria-modal="true" aria-label="Laboratório de Pesquisa" tabIndex={-1} data-qa="lab-overlay">
      <TopBar tab={tab} />
      <div className="lab-body">
        {tab === 'pesquisa' ? <Research /> : null}
        {tab === 'arvore' ? <Tree view={tree} /> : null}
        {tab === 'registro' ? <Records /> : null}
      </div>
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
