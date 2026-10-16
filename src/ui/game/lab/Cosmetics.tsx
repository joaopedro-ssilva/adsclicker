'use client';
import { useState } from 'react';
import type { LabCosmeticEntry, LabCosmeticsView } from '@/game/engine/views';
import { content, useGame, useLabCosmeticsView } from '@/game/store';
import { Button } from '@/ui/kit';
import { CosmeticCard } from './CosmeticCard';
import { LabStage, StaticMonitor } from './LabStage';
import { ItemArt } from './ItemArt';
import { useLabOverlay } from './labOverlayStore';

/** What the preview wears: the equipped set with the hovered or selected cosmetic put over it. */
interface Look {
  monitor: string;
  theme: string;
  decor: string[];
  start: string;
}

function equippedLook(view: LabCosmeticsView): Look {
  return {
    monitor: view.monitors.find((entry) => entry.equipped)?.id ?? content.lab.cosmetics.defaults.monitor,
    theme: view.themes.find((entry) => entry.equipped)?.id ?? content.lab.cosmetics.defaults.theme,
    decor: view.decor.filter((entry) => entry.equipped).map((entry) => entry.id),
    start: view.starts.find((entry) => entry.equipped)?.id ?? content.lab.cosmetics.defaults.startItem,
  };
}

function withPreview(look: Look, entry: LabCosmeticEntry | undefined, max: number): Look {
  // A cosmetic that is not owned stays a mystery: the preview does not show it.
  if (!entry || !entry.owned) return look;
  if (entry.kind === 'monitor') return { ...look, monitor: entry.id };
  if (entry.kind === 'theme') return { ...look, theme: entry.id };
  if (entry.kind === 'start') return { ...look, start: entry.id };
  if (look.decor.includes(entry.id)) return look;
  // A full display shows the new object in place of the last one.
  return {
    ...look,
    decor: [...look.decor.slice(0, Math.max(0, max - 1)), entry.id],
  };
}

/** The preview: the idle screen of the monitor with the look on it. */
export function PreviewStage({ look }: { look: Look }) {
  const start = content.lab.cosmetics.items.find((entry) => entry.id === look.start);
  return (
    <div className="lab-preview" data-lab-theme={look.theme} data-qa="lab-preview">
      <LabStage decor={look.decor}>
        <StaticMonitor skin={look.monitor}>
          <div className="lab-center lab-ready">
            <p className="lab-kicker">Nova pesquisa</p>
            {start?.art ? (
              <div className="lab-start-item">
                <ItemArt asset={start.art} name={start.name} size={64} />
                <div>
                  <p className="lab-item-name">{start.name}</p>
                  <p className="lab-item-power">Item inicial</p>
                  {start.free ? null : <p className="lab-start-bonus">{start.description}</p>}
                </div>
              </div>
            ) : null}
            <p className="lab-center-fine">Pré-visualização</p>
          </div>
        </StaticMonitor>
      </LabStage>
    </div>
  );
}

function Price({ entry }: { entry: LabCosmeticEntry }) {
  if (entry.forSale) return <>Loja · {entry.priceText} ADScoins</>;
  return <>{entry.hint ?? 'Conquista (em breve)'}</>;
}

interface GroupProps {
  title: string;
  hint: string;
  entries: LabCosmeticEntry[];
  full?: boolean;
  setPreview: (id: string | null) => void;
  select: (id: string) => void;
  selected: string | null;
}

function Group({ title, hint, entries, full, setPreview, select, selected }: GroupProps) {
  const equip = useGame((store) => store.equipLabCosmetic);
  const openShop = useLabOverlay((store) => store.openShop);
  const kind = entries[0]?.kind ?? 'group';
  const folded = useLabOverlay((store) => store.folded[kind] === true);
  const toggle = useLabOverlay((store) => store.toggleFold);
  return (
    <section className="lab-cosm-group" aria-label={title} data-qa={`lab-cosm-${entries[0]?.kind ?? 'group'}`}>
      <header className="lab-section-head lab-cosm-fold">
        <button type="button" aria-expanded={!folded} onClick={() => toggle(kind)} data-qa={`lab-cosm-fold-${kind}`}>
          <span aria-hidden="true">{folded ? '▸' : '▾'}</span>
          <h3>{title}</h3>
        </button>
        <p>{hint}</p>
      </header>
      <ul className="lab-cosm-list" hidden={folded}>
        {entries.map((entry) => {
          const decor = entry.kind === 'decor';
          let actions;
          if (entry.owned) {
            actions =
              decor && entry.equipped ? (
                <Button size="sm" variant="secondary" onClick={() => equip(entry.id, false)} data-qa="lab-cosmetic-off">
                  Tirar
                </Button>
              ) : entry.equipped ? null : (
                <Button
                  size="sm"
                  onClick={() => equip(entry.id)}
                  disabled={decor && full}
                  title={decor && full ? 'A mesa está cheia: tire uma decoração antes.' : undefined}
                  data-qa="lab-cosmetic-on"
                >
                  Equipar
                </Button>
              );
          } else {
            actions = entry.forSale ? (
              <Button size="sm" variant="secondary" onClick={openShop} data-qa="lab-cosmetic-shop">
                Ver na Loja
              </Button>
            ) : null;
          }
          return (
            <CosmeticCard
              key={entry.id}
              entry={entry}
              lock={<Price entry={entry} />}
              actions={actions}
              onPreview={setPreview}
              onSelect={select}
              selected={selected === entry.id}
              mask
            />
          );
        })}
      </ul>
    </section>
  );
}

/** The Cosméticos tab: a preview of the monitor on one side and, on the other, everything cosmetic of the lab to swap. */
export function Cosmetics() {
  const view = useLabCosmeticsView();
  const openShop = useLabOverlay((store) => store.openShop);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const all = [...view.monitors, ...view.themes, ...view.decor, ...view.starts];
  const shown = all.find((entry) => entry.id === (hover ?? selected));
  const look = withPreview(equippedLook(view), shown, view.decorMax);
  const full = view.decorOn >= view.decorMax;

  const common = { setPreview: setHover, select: setSelected, selected };
  return (
    <div className="lab-cosm" data-qa="lab-cosmetics">
      <section className="lab-panel lab-cosm-stage" aria-label="Pré-visualização">
        <header className="lab-section-head">
          <h3>Pré-visualização</h3>
          <p>
            {view.ownedCount} de {view.totalCount} cosméticos seus
          </p>
        </header>
        <PreviewStage look={look} />
        <div className="lab-cosm-caption" aria-live="polite">
          {shown ? (
            <>
              <p className="lab-cosm-caption-name">{shown.owned ? shown.name : '???'}</p>
              {shown.owned ? <p>{shown.description}</p> : null}
              <p className="lab-cosm-caption-state">
                {shown.owned ? shown.equipped ? 'Em uso agora.' : 'Seu. Aperte Equipar para usar.' : <Price entry={shown} />}
              </p>
            </>
          ) : (
            <p>Passe o mouse (ou toque) em um cosmético para ver como fica.</p>
          )}
        </div>
        <Button variant="secondary" onClick={openShop} data-qa="lab-cosm-open-shop">
          Abrir a Loja
        </Button>
      </section>

      <section className="lab-panel lab-cosm-catalog" aria-label="Cosméticos">
        <Group title="Skins do monitor" hint="A moldura e o brilho da tela." entries={view.monitors} {...common} />
        <Group title="Tema do Laboratório" hint="As cores de todo o laboratório e o brilho do monitor." entries={view.themes} {...common} />
        <Group
          title={`Decoração (${view.decorOn}/${view.decorMax})`}
          hint="Objetos em volta do monitor, nunca sobre a tela."
          entries={view.decor}
          full={full}
          {...common}
        />
        <Group
          title="Item inicial"
          hint="Substitui o Mouse quebrado no começo de cada pesquisa. Vale na próxima."
          entries={view.starts}
          {...common}
        />
      </section>
    </div>
  );
}
