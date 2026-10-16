'use client';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { formatNumber } from '@/game/engine/format';
import type { LabNodeView, LabTreeView } from '@/game/engine/views';
import { useGame, useGameState, useLabTreeView } from '@/game/store';
import { Button, Modal } from '@/ui/kit';
import { cssVariables } from '@/ui/theme';
import { fmtInt } from '../panel/lib/numbers';
import { NODE_STATE_LABEL, nodeState, recordSections } from './labFormat';
import { branchGrid, neighbour } from './treeGrid';
import type { Direction } from './treeGrid';

const BRANCHES = [
  { id: 'codigo', name: 'Código', note: 'Dano da pesquisa' },
  { id: 'infra', name: 'Infra', note: 'Monitor e sobrevivência' },
  { id: 'produto', name: 'Produto', note: 'Sorte, Commits e clicker' },
] as const;

const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

const commits = (value: number) => `${formatNumber(value, { integer: true })} ${value === 1 ? 'Commit' : 'Commits'}`;

function requirement(node: LabNodeView, names: Map<string, string>): string {
  return node.requires.map((id) => names.get(id) ?? id).join(', ');
}
/** The bar under the tree: the node in focus, what the next level changes, and the purchase. */
function Selected({ node, balance, names }: { node: LabNodeView; balance: number; names: Map<string, string> }) {
  const buy = useGame((store) => store.buyLabNode);
  const state = nodeState(node);
  const canBuy = state === 'ready';
  return (
    <section className="lab-selected" aria-label="Habilidade selecionada" data-qa="lab-selected">
      <div className="lab-selected-info">
        <p className="lab-kicker-small">Habilidade selecionada</p>
        <h4>
          <span aria-hidden="true">{node.emoji}</span> {node.name}
        </h4>
        <p className="lab-selected-level">
          {node.maxed ? `Nível máximo (${node.level})` : `Nível ${node.level} → ${node.level + 1}`}
        </p>
        <p className="lab-selected-desc">{node.description}</p>
        {node.requires.length > 0 ? <p className="lab-selected-req" data-locked={state === 'locked'}>Requer: {requirement(node, names)}</p> : null}
        {node.effects.length > 0 ? (
          <ul className="lab-selected-effects">
            {node.effects.map((effect) => (
              <li key={effect.label}>
                {effect.label}: {effect.now} {'→'} <b>{effect.next}</b>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="lab-selected-buy">
        <Button
          disabled={!canBuy}
          data-qa={`lab-buy-${node.id}`}
          aria-label={node.maxed ? `${node.name}: nível máximo` : `Comprar ${node.name} por ${node.cost} Commits`}
          onClick={() => void buy(node.id)}
        >
          {node.maxed ? 'Nível máximo' : `Comprar · ${node.cost !== null ? commits(node.cost) : ''}`}
        </Button>
        <p className="lab-selected-balance">
          {state === 'locked'
            ? `Requer: ${requirement(node, names)}`
            : node.cost === null
              ? `Saldo: ${commits(balance)}`
              : canBuy
                ? `Saldo após a compra: ${commits(balance - node.cost)}`
                : `Faltam ${commits(node.cost - balance)}`}
        </p>
      </div>

      <ul className="lab-legend" aria-label="Legenda">
        <li data-state="ready">Disponível</li>
        <li data-state="max">Máximo</li>
        <li data-state="locked">Bloqueado</li>
        <li data-selected="true">Selecionada</li>
      </ul>
    </section>
  );
}

/** One branch: its nodes as emoji tiles on a grid, joined by the lines of their requirements. */
function Branch({
  branch,
  nodes,
  selected,
  onSelect,
  onBuy,
}: {
  branch: (typeof BRANCHES)[number];
  nodes: LabNodeView[];
  selected: string;
  onSelect: (id: string) => void;
  onBuy: (node: LabNodeView) => void;
}) {
  const grid = branchGrid(nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, node: LabNodeView) => {
    const direction = ARROWS[event.key];
    if (direction) {
      const next = neighbour(grid.nodes, node.id, direction);
      if (next) {
        event.preventDefault();
        onSelect(next.id);
        document.querySelector<HTMLElement>(`[data-qa="lab-node-${next.id}"]`)?.focus();
      }
    } else if (event.key === 'Enter' && selected === node.id) {
      event.preventDefault();
      onBuy(node);
    }
  };

  return (
    <section className="lab-branch" data-branch={branch.id} aria-label={`Ramo ${branch.name}`}>
      <h4>
        {branch.name}
        <small>{branch.note}</small>
      </h4>
      <div className="lab-tree-board">
        <div className="lab-tree-field" style={cssVariables({ '--cols': String(grid.cols), '--rows': String(grid.rows) })}>
          <svg className="lab-tree-edges" viewBox={`0 0 ${grid.cols} ${grid.rows}`} preserveAspectRatio="none" aria-hidden="true">
            {grid.edges.map((edge) => {
              const reached = (byId.get(edge.parent)?.level ?? 0) > 0;
              const taken = reached && (byId.get(edge.child)?.level ?? 0) > 0;
              return <polyline key={`${edge.parent}>${edge.child}`} points={edge.points} data-edge={taken ? 'taken' : reached ? 'open' : 'closed'} vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
          {grid.nodes.map((node) => {
            const state = nodeState(node);
            return (
              <div key={node.id} className="lab-tree-slot" style={cssVariables({ '--col': String(node.col), '--row': String(node.row), '--cols': String(grid.cols), '--rows': String(grid.rows) })}>
                <button
                  type="button"
                  className="lab-tree-tile"
                  data-state={state}
                  aria-pressed={selected === node.id}
                  title={node.name}
                  data-qa={`lab-node-${node.id}`}
                  aria-label={`${node.name}, nível ${node.level} de ${node.maxLevel}. ${NODE_STATE_LABEL[state]}.`}
                  onClick={() => onSelect(node.id)}
                  onFocus={() => onSelect(node.id)}
                  onKeyDown={(event) => onKeyDown(event, node)}
                >
                  <span className="lab-tree-tile-emoji" aria-hidden="true">
                    {node.emoji}
                  </span>
                  <span className="lab-tree-tile-level" aria-hidden="true">
                    {node.maxed ? 'MÁX' : `${node.level}/${node.maxLevel}`}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Resets the tree: all the Commits come back. Not during a run (the view says why). */
function TreeReset({ view }: { view: LabTreeView }) {
  const reset = useGame((store) => store.resetLabTree);
  const [open, setOpen] = useState(false);
  const unit = view.refund === 1 ? 'Commit' : 'Commits';
  return (
    <div className="lab-tree-reset" data-qa="lab-tree-reset">
      <Button variant="secondary" size="sm" disabled={!view.canReset} title={view.resetReason ?? undefined} onClick={() => setOpen(true)} data-qa="lab-tree-reset-open">
        Resetar árvore
      </Button>
      {!view.canReset && view.spent > 0 && view.resetReason ? <small>{view.resetReason}</small> : null}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Resetar a árvore?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} data-qa="lab-tree-reset-cancel">
              Cancelar
            </Button>
            <Button
              variant="danger"
              data-qa="lab-tree-reset-confirm"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Resetar e receber {fmtInt(view.refund)} {unit}
            </Button>
          </>
        }
      >
        <p>
          Todos os nós voltam a zero e <strong>{fmtInt(view.refund)}</strong> {unit} voltam para você gastar de novo. É de graça e vale quantas vezes
          quiser, desde que não haja uma corrida em andamento.
        </p>
      </Modal>
    </div>
  );
}

function TreePanel({ view }: { view: LabTreeView }) {
  const buy = useGame((store) => store.buyLabNode);
  const names = new Map(view.nodes.map((node) => [node.id, node.name]));
  const first = view.nodes.find((node) => node.available && !node.maxed) ?? view.nodes[0];
  const [picked, setPicked] = useState<string | null>(null);
  const selected = view.nodes.find((node) => node.id === picked) ?? first;

  return (
    <section className="lab-panel lab-tree" aria-label="Árvore do Laboratório" data-qa="lab-tree">
      <header className="lab-tree-head">
        <div>
          <h3>Árvore do Laboratório</h3>
          <p>Melhorias permanentes. Sua evolução sobrevive à formatura.</p>
        </div>
        <div className="lab-tree-side">
          <p className="lab-tree-wallet">
            <b>{fmtInt(view.commits)}</b> Commits disponíveis
            <span>Investidos: {fmtInt(view.spent)}</span>
          </p>
          <TreeReset view={view} />
        </div>
      </header>

      <div className="lab-branches">
        {BRANCHES.map((branch) => (
          <Branch
            key={branch.id}
            branch={branch}
            nodes={view.nodes.filter((node) => node.branch === branch.id)}
            selected={selected?.id ?? ''}
            onSelect={setPicked}
            onBuy={(node) => {
              if (nodeState(node) === 'ready') void buy(node.id);
            }}
          />
        ))}
      </div>

      {selected ? <Selected node={selected} balance={view.commits} names={names} /> : null}
    </section>
  );
}
function RecordsPanel() {
  const counters = useGameState((state) => state.lab.counters);
  const best = useGameState((state) => state.lab.bestPhase);
  const tree = useLabTreeView();
  const records = recordSections(counters, best, tree.spent);
  return (
    <section className="lab-panel lab-records" aria-label="Registros" data-qa="lab-records">
      <header className="lab-section-head">
        <h3>Registros</h3>
        <p>Números de todas as pesquisas</p>
      </header>
      <dl className="lab-tiles">
        {records.tiles.map((tile) => (
          <div key={tile.label}>
            <dt>{tile.label}</dt>
            <dd>{tile.value}</dd>
          </div>
        ))}
      </dl>
      {records.sections.map((section) => (
        <div key={section.title} className="lab-record-section">
          <h4>{section.title}</h4>
          <dl className="lab-record-list">
            {section.rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}

/** The Progressão tab: the permanent tree on the left, the lifetime numbers on the right. */
export function Progression({ view }: { view: LabTreeView }) {
  return (
    <div className="lab-prog">
      <TreePanel view={view} />
      <RecordsPanel />
    </div>
  );
}
