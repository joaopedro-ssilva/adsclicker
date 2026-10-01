'use client';
import { useEffect, useState } from 'react';
import { audio } from '@/ui/audio';
import { Button, Meter, ProgressBar } from '@/ui/kit';
import { Specimen } from '../parts/Specimen';

const COOLDOWN_MS = 5000;

export function ProgressSpecimen() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 100)), 100);
    return () => clearTimeout(timer);
  }, [remaining]);

  const cooling = remaining > 0;

  return (
    <Specimen title="Progresso e recarga" code="01.B">
      <div className="stack">
        <ProgressBar value={68} label="Rumo ao próximo marco" />
        <ProgressBar value={7} max={10} label="Combo" valueLabel="7/10" segmented />
        <ProgressBar value={0} label="Aguardando a primeira aula" size="sm" />
        <ProgressBar value={100} label="Pesquisa concluída" tone="good" />
        <ProgressBar value={22} label="Conexão instável" tone="bad" size="sm" />
      </div>

      <div className="specimen-rule" />
      <p className="specimen-caption">Medidores radiais</p>
      <div className="row meters">
        <Meter value={0} label="Início" />
        <Meter value={35} label="Recarga" />
        <Meter value={70} label="Quase" />
        <Meter value={100} label="Pronto" />
      </div>

      <div className="specimen-rule" />
      <p className="specimen-caption">Recarga de habilidade: 5 segundos, em 24 passos</p>
      <div className="cooldown-demo">
        <Meter value={COOLDOWN_MS - remaining} max={COOLDOWN_MS} label={cooling ? `${Math.ceil(remaining / 1000)} s` : 'Café'} size="lg">
          <span aria-hidden="true">☕</span>
        </Meter>
        <Button
          size="sm"
          variant="secondary"
          disabled={cooling}
          onClick={() => {
            setRemaining(COOLDOWN_MS);
            audio.play('ability');
          }}
        >
          Usar habilidade
        </Button>
      </div>
      <div className="specimen-rule" />
      <Meter variant="bar" value={40} label="Habilidade em recarga" />
    </Specimen>
  );
}
