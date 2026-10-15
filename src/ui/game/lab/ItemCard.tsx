'use client';
import type { ReactNode } from 'react';
import { content } from '@/game/store';
import { formatNumber } from '@/game/engine/format';
import type { LabAffixView, LabItemView, LabLine } from '@/game/engine/views';
import { ItemArt } from './ItemArt';
import { affixText, splitLines } from './labFormat';

/** The lines of an affix or buff: what it does for the clicker first, then what only the Laboratório uses. */
export function LineList({ lines }: { lines: readonly LabLine[] }) {
  const { clicker, lab } = splitLines(content, lines);
  return (
    <span className="lab-lines">
      {clicker.map((line) => (
        <span key={`c-${line.label}`} className="lab-line" data-scope="clicker">
          {affixText(line)}
        </span>
      ))}
      {lab.map((line) => (
        <span key={`l-${line.label}`} className="lab-line" data-scope="lab">
          {affixText(line)} <i className="lab-line-tag">lab</i>
        </span>
      ))}
    </span>
  );
}

interface ItemBodyProps {
  item: LabItemView;
  /** "card" stacks art and name over the affixes (the equipment grid); "row" puts the art beside everything else (rewards, compare). */
  variant?: 'card' | 'row';
  /** Art side in px. */
  art?: number;
  /** A line above the item inside its frame (the slot name of the equipment cards). */
  label?: ReactNode;
  /** Adds a control to the end of each affix row (the "Sortear" button of the bench). */
  affixAction?: (affix: LabAffixView) => ReactNode;
  /** Shown under the affixes (the level up button, the compare buttons). */
  children?: ReactNode;
}

/** An item as the bench, the rewards and the compare view show it: art, name, rarity, level, power and every affix written out. */
export function ItemBody({ item, variant = 'card', art = 56, label, affixAction, children }: ItemBodyProps) {
  const id = (
    <div className="lab-item-id">
      <p className="lab-item-name">{item.name}</p>
      <p className="lab-item-meta">
        <b className="lab-rarity">{item.rarityName}</b>
        <span>
          Nv {item.level}/{item.maxLevel}
        </span>
      </p>
      <p className="lab-item-power">
        Poder <b>{formatNumber(item.power)}</b>
        {item.nextPower !== null ? <small> (próximo nível: {formatNumber(item.nextPower)})</small> : <small> (nível máximo)</small>}
      </p>
    </div>
  );

  const rest = (
    <>
      {item.affixes.length > 0 ? (
        <ul className="lab-affixes">
          {item.affixes.map((affix) => (
            <li key={affix.index} className="lab-affix">
              <LineList lines={affix.lines} />
              {affixAction ? affixAction(affix) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="lab-item-note">Sem atributos: só dano automático na pesquisa.</p>
      )}

      {item.unique?.active ? (
        <p className="lab-item-unique">
          <b>Efeito lendário</b> {item.unique.description}
        </p>
      ) : null}
      {item.set ? (
        <p className="lab-item-set" data-on={item.set.pieces >= 2}>
          {item.set.name}: {item.set.pieces} {item.set.pieces === 1 ? 'peça' : 'peças'} equipadas
        </p>
      ) : null}
      {children}
    </>
  );

  return (
    <div className="lab-item" data-variant={variant} data-rarity={item.rarity} data-qa={`lab-item-${item.base}`}>
      {label}
      {variant === 'row' ? (
        <div className="lab-item-row">
          <ItemArt asset={item.asset} name={item.name} size={art} />
          <div className="lab-item-main">
            {id}
            {rest}
          </div>
        </div>
      ) : (
        <>
          <div className="lab-item-head">
            <ItemArt asset={item.asset} name={item.name} size={art} />
            {id}
          </div>
          {rest}
        </>
      )}
    </div>
  );
}
