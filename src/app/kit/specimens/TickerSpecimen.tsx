'use client';
import { useState } from 'react';
import { Badge, Button, IconButton, Keycap, NumberTicker, RarityBadge } from '@/ui/kit';
import { Specimen } from '../parts/Specimen';

const format = (value: number) => value.toLocaleString('pt-BR');

export function TickerSpecimen() {
  const [value, setValue] = useState(1280);

  return (
    <Specimen title="Números e selos" code="01.C">
      <p className="specimen-caption">Contador que rola só os dígitos que mudam</p>
      <NumberTicker className="big-number" value={format(value)} numericHint={value} />
      <div className="specimen-actions">
        <IconButton icon="plus" label="Somar 125" variant="secondary" size="sm" onClick={() => setValue((current) => current + 125)} />
        <Button size="sm" variant="secondary" onClick={() => setValue((current) => current * 10)}>
          ×10
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setValue((current) => Math.max(0, current - 400))}>
          −400
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setValue(1280)}>
          Zerar
        </Button>
      </div>

      <div className="specimen-rule" />
      <p className="specimen-caption">Selos de estado</p>
      <div className="row">
        <Badge>Neutro</Badge>
        <Badge tone="accent">Em sala</Badge>
        <Badge tone="good">Disponível</Badge>
        <Badge tone="warn">Em recarga</Badge>
        <Badge tone="bad">Sem saldo</Badge>
      </div>

      <div className="specimen-rule" />
      <p className="specimen-caption">Raridade, sempre com cor e pontos</p>
      <div className="row">
        <RarityBadge rarity="common" />
        <RarityBadge rarity="rare" />
        <RarityBadge rarity="epic" />
        <RarityBadge rarity="legendary" />
      </div>

      <div className="specimen-rule" />
      <p className="specimen-caption">Teclas</p>
      <div className="row">
        <Keycap>Tab</Keycap>
        <span className="muted">navegar</span>
        <Keycap>Espaço</Keycap>
        <span className="muted">clicar</span>
        <Keycap>Esc</Keycap>
        <span className="muted">fechar</span>
      </div>
    </Specimen>
  );
}
