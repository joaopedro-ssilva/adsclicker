'use client';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { formatNumber } from '@/game/engine/format';
import type { LabMobView, LabMonitorView } from '@/game/engine/views';
import { content, useGame } from '@/game/store';
import { ASSETS } from '@/ui/art/manifest';
import { HpBar } from '@/ui/hackathon/arena/HpBar';
import { Button, Icon, ProgressBar } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import { playLimited } from '../panel/lib/feedback';
import { ScreenDecision } from './Decision';
import { ItemArt } from './ItemArt';
import { LabStage, Stickers, skinBrand } from './LabStage';
import { crackLevel, integrityTone, mobZoom, perSecond, seconds } from './labFormat';

const HIT_LIFE_MS = 380;
const MAX_HITS = 6;

/** Cracks of the glass, from the first (top right) to the spider in the middle. Drawn twice: a dark edge and a bright line. */
const CRACKS = [
  'M88 0 L84 9 L88 15 L80 24 L83 30 L74 41 M80 24 L70 22 L64 28',
  'M0 58 L9 55 L13 62 L24 60 L28 68 L40 66 M24 60 L26 50 L20 44',
  'M50 38 L42 30 L44 20 L38 10 L40 0 M50 38 L60 34 L68 40 L78 36 M50 38 L47 48 L54 56 L52 75 M50 38 L36 42 L30 52 L18 54',
  'M64 75 L66 66 L74 62 L72 54 L82 50 M96 22 L90 28 L92 36 M14 14 L22 18 L20 26 L30 30 M58 0 L56 8 L62 14',
];

function CrackLayer({ level }: { level: number }) {
  if (level === 0) return null;
  return (
    <svg className="lab-cracks" viewBox="0 0 100 75" preserveAspectRatio="none" aria-hidden="true">
      {CRACKS.slice(0, level).map((path) => (
        <g key={path}>
          <path className="lab-crack-edge" d={path} />
          <path className="lab-crack-line" d={path} />
        </g>
      ))}
    </svg>
  );
}

function Mob({ mob }: { mob: LabMobView }) {
  const meta = ASSETS[mob.asset];
  return (
    <div className="lab-mob" data-boss={mob.boss} data-qa="lab-mob">
      <p className="lab-mob-name">{mob.name}</p>
      <HpBar hp={mob.hp} maxHp={mob.maxHp} tone={mob.boss ? 'boss' : 'enemy'} label={`Vida: ${mob.name}`} />
      <span
        className="lab-mob-sprite"
        role="img"
        aria-label={mob.name}
        style={{
          ...cssVariables({
            '--w': String(meta?.w ?? 40),
            '--h': String(meta?.h ?? 46),
          }),
          backgroundImage: `url(/assets/${mob.asset}.png)`,
        }}
      />
    </div>
  );
}

function Hud({ view }: { view: LabMonitorView }) {
  const danger = view.bossLeft !== null && view.bossLeft <= 8;
  return (
    <div className="lab-hud">
      <div className="lab-hud-row">
        <p className="lab-phase" data-qa="lab-phase">
          Fase <b>{view.phase}</b>
          {view.boss ? <em>Chefão</em> : null}
        </p>
        <p className="lab-hud-best">Recorde {view.bestPhase}</p>
      </div>
      {view.status === 'fighting' ? (
        view.bossLeft !== null && view.bossTotal ? (
          <div className="lab-timer" data-danger={danger} role="timer" aria-label={`Prazo do chefão: ${seconds(view.bossLeft)}`}>
            <span className="lab-timer-text">{seconds(view.bossLeft)}</span>
            <span className="lab-timer-bar">
              <i
                style={{
                  width: `${Math.max(0, Math.min(1, view.bossLeft / view.bossTotal)) * 100}%`,
                }}
              />
            </span>
          </div>
        ) : (
          <div
            className="lab-wave"
            role="progressbar"
            aria-label="Progresso da onda"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(view.waveProgress * 100)}
          >
            <i style={{ width: `${view.waveProgress * 100}%` }} />
          </div>
        )
      ) : null}
    </div>
  );
}

function Integrity({ view }: { view: LabMonitorView }) {
  const drain = view.drain > 0 ? ` · -${perSecond(view.drain)}/s` : '';
  // The shield (tree: Firewall do lab) takes the drain first: a strip of its own under the bar, in another colour.
  const shield = Math.ceil(view.shield);
  const share = view.maxIntegrity > 0 ? Math.min(1, view.shield / view.maxIntegrity) : 0;
  return (
    <div className="lab-integrity" data-shield={shield > 0 || undefined} data-qa="lab-integrity">
      <ProgressBar
        label="Integridade do monitor"
        value={view.integrity}
        max={view.maxIntegrity}
        valueLabel={`${Math.ceil(Math.max(0, view.integrity))} / ${Math.round(view.maxIntegrity)}${drain}`}
        segmented
        segments={25}
        size="sm"
        tone={integrityTone(view.integrityFraction)}
      />
      {shield > 0 ? (
        <div className="lab-shield" role="img" aria-label={`Escudo da fase: ${shield} pontos`} data-qa="lab-shield">
          <span className="lab-shield-fill" style={{ width: `${share * 100}%` }} />
          <span className="lab-shield-text">+{shield} escudo</span>
        </div>
      ) : null}
    </div>
  );
}

function ReadyScreen({ view }: { view: LabMonitorView }) {
  const start = useGame((store) => store.startLabRun);
  // The starting item the player wears (a shop cosmetic) or, by default, the Mouse quebrado.
  const startId = useGame((store) => store.state.lab.cosmetics.startItem);
  const starter = content.lab.bases.find((base) => base.id === startId) ?? content.lab.bases.find((base) => base.id === content.lab.starter);
  const bonus = starter?.effects ? (content.lab.cosmetics.items.find((entry) => entry.id === starter.id)?.description ?? null) : null;
  const power = content.lab.items.power.base * (content.lab.items.power.rarity.comum ?? 1);
  const setupAtHome = useGame((store) => (store.state.lab.tree['setup-de-casa'] ?? 0) > 0);
  return (
    <div className="lab-center lab-ready" data-qa="lab-ready">
      <p className="lab-kicker">Nova pesquisa</p>
      {starter ? (
        <div className="lab-start-item">
          <ItemArt asset={starter.asset} name={starter.name} size={84} />
          <div>
            <p className="lab-item-name">{starter.name}</p>
            <p className="lab-item-meta">
              <b className="lab-rarity" data-rarity="comum">
                Comum
              </b>
              <span>Ferramenta</span>
            </p>
            <p className="lab-item-power">
              Poder <b>{formatNumber(power)}</b>
            </p>
            {bonus ? <p className="lab-start-bonus">{bonus}</p> : null}
          </div>
        </div>
      ) : null}
      <p className="lab-center-text">
        Você começa com {starter?.name.toLowerCase() ?? 'um item'}
        {setupAtHome ? ' e um item comum no Setup' : ''}, {content.lab.run.startIntegrity} de integridade e nenhum atributo. Derrote as ondas, escolha
        uma recompensa a cada fase e não deixe o monitor quebrar.
      </p>
      <Button size="lg" onClick={() => void start()} data-qa="lab-start">
        Iniciar pesquisa
      </Button>
      <p className="lab-center-fine">
        Uma pesquisa por turma.
        {view.bestPhase > 0 ? ` Recorde: fase ${view.bestPhase}.` : ''}
      </p>
    </div>
  );
}

function OffScreen({ view }: { view: LabMonitorView }) {
  return (
    <div className="lab-center lab-off" data-qa="lab-off">
      <Icon name="lock" size={36} />
      <p className="lab-kicker">Monitor desligado</p>
      <p className="lab-center-text">
        <b>{view.available.reason}</b> para ligar o monitor desta turma.
      </p>
      <p className="lab-center-fine">Suba cada aula ao nível 1. A árvore e o registro continuam abertos nas abas.</p>
    </div>
  );
}

function BrokenScreen({ view }: { view: LabMonitorView }) {
  const record = view.phase >= view.bestPhase;
  return (
    <div className="lab-center lab-broken" data-qa="lab-broken">
      <p className="lab-broken-title">Tela quebrada</p>
      <p className="lab-center-text">{view.brokenBy === 'timer' ? 'O prazo do chefão acabou.' : 'A integridade chegou a zero.'}</p>
      <dl className="lab-result">
        <div>
          <dt>Fase alcançada</dt>
          <dd>{view.phase}</dd>
        </div>
        <div>
          <dt>Commits ganhos</dt>
          <dd>+{formatNumber(view.commits, { integer: true })}</dd>
        </div>
        <div data-record={record}>
          <dt>Recorde</dt>
          <dd>{view.bestPhase}</dd>
        </div>
      </dl>
      {record ? <p className="lab-record-flag">Novo recorde!</p> : null}
      <p className="lab-center-fine">
        O Laboratório reabre na próxima turma. Os itens continuam equipados e seguem reforçando o clicker até a formatura.
      </p>
    </div>
  );
}

interface MonitorProps {
  view: LabMonitorView;
  /** The line the screen flashes for the last thing that happened (phase cleared, item gained...). */
  feed: { id: number; text: string } | null;
}

interface Hit {
  id: number;
  x: number;
  y: number;
}

/**
 * The monitor: a CRT frame whose glass shows the fight. Clicking inside it hits the mobs (a little: the game caps the
 * clicks that count), the cracks grow as the integrity drops, and a broken run leaves a shattered screen with the result.
 */
export function Monitor({ view, feed }: MonitorProps) {
  const click = useGame((store) => store.labClick);
  const cosmetics = useGame((store) => store.state.lab.cosmetics);
  const [hits, setHits] = useState<Hit[]>([]);
  const nextHit = useRef(1);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const fighting = view.status === 'fighting';
  const broken = view.status === 'broken';
  const cracks = view.hasRun ? crackLevel(view.integrityFraction, broken) : 0;
  const ready = view.canStart;
  const dead = !view.hasRun && !view.canStart;

  const spark = (x: number, y: number) => {
    const id = nextHit.current++;
    setHits((list) => [...list.slice(-(MAX_HITS - 1)), { id, x, y }]);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setHits((list) => list.filter((hit) => hit.id !== id));
    }, HIT_LIFE_MS);
    timers.current.add(timer);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!fighting || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    spark(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
    click();
    // Through the game's sound system (it follows the sound setting); limited so a fast clicker is a patter, not a buzz.
    playLimited('labHit', 55);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!fighting || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    spark(40 + Math.random() * 20, 40 + Math.random() * 20);
    click();
    playLimited('labHit', 55);
  };

  const state = broken ? 'broken' : fighting ? 'fighting' : ready ? 'ready' : dead ? 'off' : 'paused';
  const zoom = mobZoom(view.mobs.length);

  return (
    <LabStage decor={cosmetics.decor}>
      <div
        className="lab-monitor"
        data-state={state}
        data-crack={cracks}
        data-boss={view.boss || undefined}
        data-skin={cosmetics.monitor}
        data-qa="lab-monitor"
      >
        <div className="lab-bezel">
          <div
            className="lab-screen"
            data-hit={hits.length > 0}
            role={fighting ? 'button' : undefined}
            tabIndex={fighting ? 0 : undefined}
            aria-label={fighting ? 'Monitor da pesquisa. Clique para causar dano extra.' : undefined}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            data-qa="lab-screen"
          >
            {fighting || view.status === 'reward' || view.status === 'equip' ? <Hud view={view} /> : null}

            {fighting ? (
              <div className="lab-arena" style={cssVariables({ '--z': String(zoom) })} data-count={view.mobs.length}>
                {view.mobs.map((mob) => (
                  <Mob key={mob.uid} mob={mob} />
                ))}
              </div>
            ) : null}

            {ready ? <ReadyScreen view={view} /> : null}
            {dead ? <OffScreen view={view} /> : null}
            {view.status === 'reward' || view.status === 'equip' ? <ScreenDecision status={view.status} /> : null}
            {broken ? <BrokenScreen view={view} /> : null}

            {view.hasRun && !broken ? <Integrity view={view} /> : null}

            <CrackLayer level={cracks} />
            <span className="lab-glare" aria-hidden="true" />
            <span className="lab-scan" aria-hidden="true" />
            {hits.map((hit) => (
              <span key={hit.id} className="lab-hit" style={{ left: `${hit.x}%`, top: `${hit.y}%` }} aria-hidden="true" />
            ))}
            {feed ? (
              <p key={feed.id} className="lab-feed" role="status">
                {feed.text}
              </p>
            ) : null}
          </div>
          <div className="lab-bezel-bar">
            <span className="lab-led" aria-hidden="true" />
            <span className="lab-brand">{skinBrand(cosmetics.monitor)}</span>
          </div>
          {cosmetics.monitor === 'monitor-tubo-adesivado' ? <Stickers /> : null}
        </div>
        <div className="lab-stand" aria-hidden="true" />
      </div>
    </LabStage>
  );
}
