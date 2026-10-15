'use client';
import { formatNumber } from '@/game/engine/format';
import type { LabNodeView, LabTreeView } from '@/game/engine/views';
import { useGame, useGameState, useLabTreeView } from '@/game/store';
import { Button } from '@/ui/kit';
import { fmtInt } from '../panel/lib/numbers';
import { recordRows } from './labFormat';

const BRANCHES = [
  { id: 'codigo', name: 'Código', note: 'Dano da pesquisa' },
  { id: 'infra', name: 'Infra', note: 'O monitor e os prazos' },
  { id: 'produto', name: 'Produto', note: 'Sorte, Commits e o clicker' },
] as const;

function Pips({ level, max }: { level: number; max: number }) {
  return (
    <span className="lab-pips" role="img" aria-label={`Nível ${level} de ${max}`}>
      {Array.from({ length: max }, (_, index) => (
        <i key={index} data-on={index < level} />
      ))}
    </span>
  );
}

function Node({ node, parents }: { node: LabNodeView; parents: string }) {
  const buy = useGame((store) => store.buyLabNode);
  const locked = !node.available && !node.maxed;
  return (
    <li className="lab-node" data-locked={locked} data-maxed={node.maxed} data-affordable={node.affordable && node.available} data-qa={`lab-node-${node.id}`}>
      <span className="lab-node-emoji" aria-hidden="true">
        {node.emoji}
      </span>
      <div className="lab-node-body">
        <p className="lab-node-name">
          {node.name} <Pips level={node.level} max={node.maxLevel} />
        </p>
        <p className="lab-node-text">{node.description}</p>
        {locked ? <p className="lab-node-lock">Requer: {parents}</p> : null}
      </div>
      <Button
        size="sm"
        variant={node.maxed ? 'ghost' : 'primary'}
        disabled={node.maxed || locked || !node.affordable}
        data-qa={`lab-buy-${node.id}`}
        aria-label={node.maxed ? `${node.name}: nível máximo` : `Comprar ${node.name} por ${node.cost} Commits`}
        onClick={() => void buy(node.id)}
      >
        {node.maxed ? 'Máximo' : 'Comprar'}
        {node.cost !== null ? <small>{formatNumber(node.cost, { integer: true })} Commits</small> : null}
      </Button>
    </li>
  );
}

/** The permanent tree: three branches, bought with Commits, kept across graduations. */
export function Tree({ view }: { view: LabTreeView }) {
  const names = new Map(view.nodes.map((node) => [node.id, node.name]));
  return (
    <div className="lab-tree" data-qa="lab-tree">
      <header className="lab-section-head">
        <h3>Árvore do Laboratório</h3>
        <p>
          <b>{fmtInt(view.commits)}</b> Commits · gastos {fmtInt(view.spent)}
        </p>
      </header>
      <p className="lab-note">Os Commits vêm de quebrar o monitor, de chefões e de reciclar itens. A árvore é permanente: sobrevive à formatura.</p>
      <div className="lab-branches">
        {BRANCHES.map((branch) => (
          <section key={branch.id} className="lab-branch" data-branch={branch.id} aria-label={`Ramo ${branch.name}`}>
            <h4>
              {branch.name}
              <small>{branch.note}</small>
            </h4>
            <ul>
              {view.nodes
                .filter((node) => node.branch === branch.id)
                .sort((a, b) => a.position.row - b.position.row)
                .map((node) => (
                  <Node key={node.id} node={node} parents={node.requires.map((id) => names.get(id) ?? id).join(', ')} />
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** The Registro: the lifetime counters of the Laboratório. */
export function Records() {
  const counters = useGameState((state) => state.lab.counters);
  const best = useGameState((state) => state.lab.bestPhase);
  const tree = useLabTreeView();
  const rows = recordRows(counters, best, tree.spent);
  return (
    <div className="lab-records" data-qa="lab-records">
      <header className="lab-section-head">
        <h3>Registro</h3>
        <p>Números de todas as turmas</p>
      </header>
      <dl className="lab-record-list">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
