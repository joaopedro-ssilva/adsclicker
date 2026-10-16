import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { content, useGame } from '@/game/store';
import { postdocView } from '@/game/engine/views';
import { formatNumber } from '@/game/engine/format';
import type { ProfessorId } from '@/game/content/types';
import { Button, Modal } from '@/ui/kit';
import { PostdocBadge } from '../../shared/PostdocBadge';

const percent = (stars: number) => Math.round(content.balance.postdoc.bonusPerStar * stars * 100);

/**
 * The Pós-doc of a professor with the Domínio at the cap: the stars they have and the button that defends the next
 * one (a confirmation says what it costs and what it gives). Renders nothing until there is something to show.
 */
export function PostdocDefence({ professor }: { professor: ProfessorId }) {
  // Primitives only: the view holds a Decimal, which is a new object on every call.
  const view = useGame(
    useShallow((store) => {
      const { price, ...rest } = postdocView(store.state, content, professor);
      return { ...rest, price: price ? formatNumber(price) : '' };
    }),
  );
  const defend = useGame((store) => store.defendPostdoc);
  const [open, setOpen] = useState(false);
  const name = content.professors[professor].name;

  const showButton = view.eligible || view.blocked === 'broke' || view.blocked === 'defendedThisTurma';
  if (view.stars === 0 && !showButton) return null;

  const { price } = view;
  const next = view.stars + 1;
  const stars = Array.from({ length: view.maxStars }, (_, i) => i < view.stars);

  return (
    <div className="postdoc" data-qa="postdoc" data-stars={view.stars}>
      <div className="postdoc-head">
        <span className="postdoc-title">Pós-doc</span>
        <span className="postdoc-pips" aria-label={`${view.stars} de ${view.maxStars} estrelas`}>
          {stars.map((on, i) => (
            <i key={i} className="postdoc-star" data-on={on} aria-hidden="true" />
          ))}
        </span>
        <span className="postdoc-bonus">{view.stars > 0 ? `Domínio ${percent(view.stars)}% mais forte` : 'Sem estrelas ainda'}</span>
      </div>
      {view.blocked === 'maxStars' ? (
        <p className="postdoc-note">Cinco estrelas: o Pós-doc de {name} está completo.</p>
      ) : showButton ? (
        <>
          <Button
            size="sm"
            disabled={view.blocked !== null}
            onClick={() => setOpen(true)}
            data-qa="postdoc-open"
            aria-label={`Defender o Pós-doc de ${name} por ${price} ADScoins`}
          >
            Defender o Pós-doc ⭐ · {price}
          </Button>
          {view.blocked === 'defendedThisTurma' ? (
            <p className="postdoc-note">Já defendido nesta turma. A próxima estrela pede o Domínio {content.balance.mastery.cap} de novo, em outra turma.</p>
          ) : view.blocked === 'broke' ? (
            <p className="postdoc-note">Faltam ADScoins para a estrela {next}.</p>
          ) : null}
        </>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Defender o Pós-doc de ${name}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} data-qa="postdoc-cancel">
              Ainda não
            </Button>
            <Button
              data-qa="postdoc-confirm"
              onClick={() => {
                setOpen(false);
                defend(professor);
              }}
            >
              Pagar {price} e ganhar a estrela {next} ⭐
            </Button>
          </>
        }
      >
        <div className="graduate-dialog postdoc-dialog" data-qa="postdoc-dialog">
          <p>
            <strong>{name}</strong> ganha uma estrela <em>permanente</em>: os bônus do Domínio dele ficam{' '}
            <strong>{percent(1)}% mais fortes</strong> por estrela. Com a estrela {next}, o Domínio vale <strong>{percent(next)}% a mais</strong>,
            nesta turma e em todas as próximas.
          </p>
          <p>
            Custa <strong>{price}</strong> ADScoins, tirados do que você tem agora. Cada estrela custa {formatNumber(content.balance.postdoc.priceGrowth, { integer: true })}x mais que a anterior.
          </p>
          <p className="muted">
            Nada mais é gasto: níveis, aulas e pesquisas ficam como estão. O Domínio volta a zero na próxima formatura, como sempre, e a
            próxima estrela só sai quando {name} chegar ao Domínio {content.balance.mastery.cap} de novo, numa turma depois desta (uma defesa
            por professor por turma).
          </p>
          <p className="postdoc-dialog-badge">
            Estrelas agora: <PostdocBadge stars={view.stars} placement="inline" /> {view.stars === 0 ? 'nenhuma' : null}
          </p>
        </div>
      </Modal>
    </div>
  );
}
