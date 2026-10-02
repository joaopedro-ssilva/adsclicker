import type { RolledAffix } from '@/hackathon/engine';
import { Button, Icon } from '@/ui/kit';
import { Commits } from '../lib/Commits';
import { affixView } from '../lib/labels';
import { QualityBar } from '../lib/QualityBar';

interface AffixRowProps {
  affix: RolledAffix;
  index: number;
  price: number;
  /** Why rerolling is off right now, or null when it is possible. */
  blocked: string | null;
  onReroll: (index: number) => void;
}

/** One line of an item: what it gives, where the roll landed, and the reroll button (never for the first one). */
export function AffixRow({ affix, index, price, blocked, onReroll }: AffixRowProps) {
  const view = affixView(affix);
  return (
    <li className="hk-affix" data-qa={`hk-affix-${index}`}>
      <div className="hk-affix-main">
        <span className="hk-affix-value">{view.value}</span>
        <span className="hk-affix-label">{view.label}</span>
        <span className="hk-affix-quality-number" title="Qualidade do sorteio, de 0 a 100">
          {Math.round(affix.quality)}
        </span>
      </div>
      <QualityBar value={affix.quality} label={`Qualidade de ${view.label}`} />
      {index === 0 ? (
        <span className="hk-affix-fixed" title="O primeiro atributo é da base e não pode ser rerrolado">
          <Icon name="lock" size={12} />
          fixo
        </span>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="hk-reroll"
          aria-disabled={blocked !== null}
          title={blocked ?? 'Sortear este atributo de novo'}
          data-qa={`hk-reroll-${index}`}
          onClick={() => {
            if (!blocked) onReroll(index);
          }}
        >
          Rerrolar
          <Commits amount={price} />
        </Button>
      )}
    </li>
  );
}
