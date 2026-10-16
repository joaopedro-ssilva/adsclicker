'use client';
import { useState } from 'react';
import { formatNumber } from '@/game/engine/format';
import type { LabNodeView, LabTreeView } from '@/game/engine/views';
import { useGame, useGameState, useLabTreeView } from '@/game/store';
import { Button } from '@/ui/kit';
import { fmtInt } from '../panel/lib/numbers';
import { NODE_STATE_LABEL, nodeForest, nodeState, recordSections } from './labFormat';
import type { ForestNode } from './labFormat';

const BRANCHES = [
  { id: 'codigo', name: 'Código', note: 'Dano da pesquisa' },
  { id: 'infra', name: 'Infra', note: 'Monitor e sobrevivência' },
  { id: 'produto', name: 'Produto', note: 'Sorte, Commits e clicker' },
] as const;

const commits = (value: number) => `${formatNumber(value, { integer: true })} ${value === 1 ? 'Commit' : 'Commits'}`;

function requirement(node: LabNodeView, names: Map<string, string>): string {
  return node.requires.map((id) => names.get(id) ?? id).join(', ');
}

function NodeCard({ node, names, selected, onSelect }: { node: LabNodeView; names: Map<string, string>; selected: boolean; onSelect: () => void }) {
  const state = nodeState(node);
  return (
    <button
      type="button"
      className="lab-node"
      data-state={state}
      aria-pressed={selected}
      data-qa={`lab-node-${node.id}`}
      aria-label={`${node.name}, nível ${node.level} de ${node.maxLevel}. ${NODE_STATE_LABEL[state]}.`}
      onClick={onSelect}
    >
      <span className="lab-node-top">
        <b>
          <span aria-hidden="true">{node.emoji}</span> {node.name}
        </b>
        <span>
          {node.level}/{node.maxLevel}
        </span>
      </span>
      <span className="lab-node-text">{node.description}</span>
      {state === 'locked' ? <span className="lab-node-need">Requer: {requirement(node, names)}</span> : null}
      <span className="lab-node-foot">
        <span className="lab-node-cost">{node.cost !== null ? commits(node.cost) : null}</span>
        <span className="lab-node-state">{NODE_STATE_LABEL[state]}</span>
      </span>
    </button>
  );
}

function Forest({ forest, names, selected, onSelect }: { forest: ForestNode<LabNodeView>[]; names: Map<string, string>; selected: string; onSelect: (id: string) => void }) {
  return (
    <ul>
      {forest.map(({ node, children }) => (
        <li key={node.id}>
          <NodeCard node={node} names={names} selected={selected === node.id} onSelect={() => onSelect(node.id)} />
          {children.length > 0 ? <Forest forest={children} names={names} selected={selected} onSelect={onSelect} /> : null}
        </li>
      ))}
    </ul>
  );
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
        {node.effects.length > 0 ? (
          <ul className="lab-selected-effects">
            {node.effects.map((effect) => (
              <li key={effect.label}>
                {effect.label}: {effect.now} {'→'} <b>{effect.next}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lab-selected-effects">{node.description}</p>
        )}
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

function TreePanel({ view }: { view: LabTreeView }) {
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
        <p className="lab-tree-wallet">
          <b>{fmtInt(view.commits)}</b> Commits disponíveis
          <span>Investidos: {fmtInt(view.spent)}</span>
        </p>
      </header>

      <div className="lab-branches">
        {BRANCHES.map((branch) => (
          <section key={branch.id} className="lab-branch" data-branch={branch.id} aria-label={`Ramo ${branch.name}`}>
            <h4>
              {branch.name}
              <small>{branch.note}</small>
            </h4>
            <div className="lab-forest">
              <Forest
                forest={nodeForest(view.nodes.filter((node) => node.branch === branch.id))}
                names={names}
                selected={selected?.id ?? ''}
                onSelect={setPicked}
              />
            </div>
          </section>
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
