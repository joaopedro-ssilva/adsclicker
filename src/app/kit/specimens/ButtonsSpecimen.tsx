'use client';
import { useState } from 'react';
import { audio } from '@/ui/audio';
import { Button, Icon, IconButton, Tooltip, toast } from '@/ui/kit';
import { Specimen } from '../parts/Specimen';

export function ButtonsSpecimen() {
  const [selected, setSelected] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  return (
    <Specimen title="Botões" code="01.A">
      <div className="specimen-grid-2">
        <Button onClick={() => toast({ title: 'Compra feita!', tone: 'good' })}>
          <Icon name="plus" />
          Primário
        </Button>
        <Button variant="secondary" onClick={() => toast('Mais uma opção para a turma.')}>
          Secundário
        </Button>
        <Button variant="ghost" onClick={() => toast('Voltou para a sala.')}>
          Discreto
        </Button>
        <Button variant="danger" onClick={() => toast({ title: 'Cuidado!', description: 'Isso apaga o progresso.', tone: 'bad' })}>
          Perigo
        </Button>
        <Button disabled>
          <Icon name="lock" />
          Bloqueado
        </Button>
        <Button variant="secondary" aria-pressed={selected} onClick={() => setSelected((value) => !value)}>
          {selected ? 'Selecionado' : 'Selecionar'}
        </Button>
      </div>

      <div className="specimen-rule" />
      <p className="specimen-caption">Tamanhos</p>
      <div className="row">
        <Button size="sm" onClick={() => audio.play('uiTap')}>
          Pequeno
        </Button>
        <Button size="md" onClick={() => audio.play('uiTap')}>
          Médio
        </Button>
        <Button size="lg" onClick={() => audio.play('uiTap')}>
          Grande
        </Button>
      </div>

      <div className="specimen-rule" />
      <p className="specimen-caption">Botões de ícone e dicas</p>
      <div className="row">
        <Tooltip content="Ajustes da turma. A dica também aparece com o teclado.">
          <IconButton icon="settings" label="Ajustes" variant="secondary" />
        </Tooltip>
        <Tooltip content="Liga ou desliga os efeitos sonoros." placement="bottom">
          <IconButton
            icon={soundOn ? 'soundOn' : 'soundOff'}
            label={soundOn ? 'Desligar som' : 'Ligar som'}
            variant="secondary"
            aria-pressed={!soundOn}
            onClick={() => setSoundOn((value) => !value)}
          />
        </Tooltip>
        <IconButton icon="trophy" label="Conquistas" variant="primary" size="sm" />
        <IconButton icon="x" label="Fechar" variant="ghost" />
        <IconButton icon="crown" label="Coroa" variant="danger" size="lg" />
      </div>
    </Specimen>
  );
}
