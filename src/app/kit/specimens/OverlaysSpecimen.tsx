'use client';
import { useState } from 'react';
import { content } from '@/game/content';
import { audio } from '@/ui/audio';
import { Badge, Button, EmptyState, Icon, Keycap, Modal, RarityBadge, Tooltip, toast } from '@/ui/kit';
import { Specimen } from '../parts/Specimen';

export function OverlaysSpecimen() {
  const [modal, setModal] = useState<'achievement' | 'confirm' | undefined>();
  const achievement = content.achievements[0];

  return (
    <Specimen title="Janelas, avisos e dicas" code="01.E">
      <div className="stack">
        <div className="row">
          <Button variant="secondary" onClick={() => setModal('achievement')}>
            <Icon name="trophy" />
            Abrir conquista
          </Button>
          <Button variant="ghost" onClick={() => setModal('confirm')}>
            Pedir confirmação
          </Button>
        </div>

        <div>
          <p className="specimen-caption">Avisos</p>
          <div className="row">
            <Button size="sm" onClick={() => toast({ title: 'Pesquisa concluída', description: '+10% de ideias muito legais.', tone: 'good' })}>
              Sucesso
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast({ title: 'Faltam ADScoins', description: 'Mais uns cliques resolvem.', tone: 'bad' })}>
              Erro
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toast({ title: 'Habilidade em recarga', tone: 'warn' })}>
              Alerta
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toast('Uma nova aula espera por você.')}>
              Neutro
            </Button>
          </div>
        </div>

        <div>
          <p className="specimen-caption">Dicas: passe o mouse ou use Tab</p>
          <div className="row">
            <Tooltip content="Em cima, centralizada na peça.">
              <Badge>Dica acima</Badge>
            </Tooltip>
            <Tooltip content="Embaixo, quando falta espaço acima." placement="bottom">
              <Button size="sm" variant="secondary">
                Dica abaixo
              </Button>
            </Tooltip>
          </div>
        </div>

        <EmptyState
          title="Nada por aqui. Ainda."
          icon="lock"
          action={
            <Button variant="ghost" size="sm" onClick={() => toast('Seu próximo clique pode ser o começo.')}>
              Continuar explorando
            </Button>
          }
        >
          Toda grande turma começa com um professor.
        </EmptyState>
      </div>

      <Modal
        open={modal === 'achievement'}
        onClose={() => setModal(undefined)}
        title="Conquista desbloqueada"
        footer={
          <Button
            onClick={() => {
              setModal(undefined);
              audio.play('achievement');
              toast({ title: 'Conquista recebida', emoji: achievement?.emoji, tone: 'good' });
            }}
          >
            Muito legal!
            <Icon name="check" />
          </Button>
        }
      >
        <div className="modal-demo">
          <span className="modal-demo-emoji" aria-hidden="true">
            {achievement?.emoji ?? '🏆'}
          </span>
          <div className="stack">
            <h3>{achievement?.name ?? 'Primeiro dia no campus'}</h3>
            <p className="muted">{achievement?.description ?? 'Você descobriu o laboratório da turma.'}</p>
            <RarityBadge rarity="epic" />
            <p className="muted modal-hint">
              <Keycap>Tab</Keycap> navega só dentro da janela e <Keycap>Esc</Keycap> fecha.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={modal === 'confirm'}
        onClose={() => setModal(undefined)}
        title="Apagar o progresso?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(undefined)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setModal(undefined);
                audio.play('cantAfford');
              }}
            >
              Apagar tudo
            </Button>
          </>
        }
      >
        <p>Essa ação não pode ser desfeita. Os diplomas também voltam a zero.</p>
      </Modal>
    </Specimen>
  );
}
