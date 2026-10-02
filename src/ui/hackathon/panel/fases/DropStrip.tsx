import { baseById } from '../lib/hk';
import { ItemIcon } from '../lib/ItemIcon';

/** The item bases a stage can drop; the ones never found yet are silhouettes. */
export function DropStrip({ drops, found }: { drops: string[]; found: ReadonlySet<string> }) {
  return (
    <ul className="hk-drops" aria-label="Itens que podem cair">
      {drops.map((id) => {
        const base = baseById.get(id);
        const known = found.has(id);
        return (
          <li key={id} data-known={known} title={known ? base?.name : 'Ainda não encontrado'}>
            <span className="hk-frame hk-drop-frame" data-empty={!known}>
              {base ? <ItemIcon asset={base.asset} scale={1} hidden={!known} /> : null}
            </span>
            <small>{known ? base?.name : '???'}</small>
          </li>
        );
      })}
    </ul>
  );
}
