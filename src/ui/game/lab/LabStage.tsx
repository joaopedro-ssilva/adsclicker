'use client';
import type { ReactNode } from 'react';
import { content } from '@/game/store';
import { itemArtSrc } from './labFormat';

/** Where the decoration objects can stand around the monitor (fixed spots; nothing ever sits on the glass or the controls). */
export type DecorSlot = 'top-left' | 'top-right' | 'desk-left' | 'desk-right';

/**
 * The natural place of each object: on top of the monitor (leaning on it), or on the desk beside the stand. It only decides
 * which of the four spots an object takes (see `placeDecor`); the art itself is the content's.
 */
const ZONE: Record<string, 'top' | 'desk'> = {
  'poster-funciona-na-minha-maquina': 'top',
  'quadro-branco-diagrama': 'top',
  'luz-neon-codigo': 'top',
  'fones-pendurados': 'top',
  luminaria: 'top',
  'trofeu-de-hackathon': 'top',
  cacto: 'top',
  'caneca-do-plantao': 'desk',
  'gato-dormindo-no-monitor': 'desk',
  'lixeira-reciclagem': 'desk',
  'pilha-de-livros-de-algoritmos': 'desk',
  'mini-servidor': 'desk',
};

const SLOTS: Record<'top' | 'desk', DecorSlot[]> = {
  top: ['top-left', 'top-right'],
  desk: ['desk-left', 'desk-right'],
};

export interface PlacedDecor {
  id: string;
  slot: DecorSlot;
  name: string;
  art: string;
}

/** The objects in the order they were put, each on a free spot of its own zone (the other zone when its own is full). */
export function placeDecor(ids: readonly string[]): PlacedDecor[] {
  const free: Record<'top' | 'desk', DecorSlot[]> = {
    top: [...SLOTS.top],
    desk: [...SLOTS.desk],
  };
  const placed: PlacedDecor[] = [];
  for (const id of ids) {
    const def = content.lab.cosmetics.items.find((entry) => entry.id === id && entry.kind === 'decor');
    if (!def?.art) continue;
    const zone = ZONE[id] ?? 'desk';
    const other = zone === 'top' ? 'desk' : 'top';
    const slot = free[zone].shift() ?? free[other].shift();
    if (slot) placed.push({ id, slot, name: def.name, art: def.art });
  }
  return placed;
}

interface LabStageProps {
  /** The decorations on display (ids). */
  decor: readonly string[];
  children: ReactNode;
}

/**
 * The monitor and what is around it: the decoration objects, standing on the monitor and on the desk beside its stand.
 * The room they need (above and below) is only taken when a spot of that zone is used.
 */
export function LabStage({ decor, children }: LabStageProps) {
  const placed = placeDecor(decor);
  const top = placed.some((entry) => entry.slot.startsWith('top'));
  const desk = placed.some((entry) => entry.slot.startsWith('desk'));
  return (
    <div className="lab-stage" data-top={top || undefined} data-desk={desk || undefined}>
      {children}
      {placed.map((entry) => (
        // eslint-disable-next-line @next/next/no-img-element -- hi-res art scaled by CSS, like the item art
        <img
          key={entry.id}
          className="lab-decor"
          data-slot={entry.slot}
          data-decor={entry.id}
          src={itemArtSrc(entry.art)}
          alt={entry.name}
          title={entry.name}
          draggable={false}
        />
      ))}
    </div>
  );
}

/** The stickers of the Tubo Adesivado: emoji with a white edge, stuck on the plastic around the tube. */
const STICKERS = ['🐞', '⭐', '💾', '☕', '🚀', '😎', '🔥', '🧩'];

export function Stickers() {
  return (
    <span className="lab-stickers" aria-hidden="true">
      {STICKERS.map((emoji, index) => (
        <i key={emoji} data-n={index}>
          {emoji}
        </i>
      ))}
    </span>
  );
}

/** The word on the bezel of each skin. */
const BRAND: Record<string, string> = {
  'monitor-crt-bege': 'ADS-CRT 1998',
  'monitor-gamer-rgb': 'ADS GAMER X',
  'monitor-ultrawide': 'ADS ULTRAWIDE',
  'monitor-tela-azul': 'ADS BLUE',
  'monitor-tubo-adesivado': 'ADS-CRT PRO',
};

export const skinBrand = (skin: string): string => BRAND[skin] ?? 'ADS-CRT 2000';

interface StaticMonitorProps {
  skin: string;
  /** What the glass shows. */
  children: ReactNode;
}

/** A monitor with nothing happening on it: the preview of the Cosméticos tab and the lab profile. Same frame as the live one. */
export function StaticMonitor({ skin, children }: StaticMonitorProps) {
  const brand = skinBrand(skin);
  return (
    <div className="lab-monitor" data-state="paused" data-skin={skin} data-static="true">
      <div className="lab-bezel">
        <div className="lab-screen">{children}</div>
        <div className="lab-bezel-bar">
          <span className="lab-led" aria-hidden="true" />
          <span className="lab-brand">{brand}</span>
        </div>
        {skin === 'monitor-tubo-adesivado' ? <Stickers /> : null}
      </div>
      <div className="lab-stand" aria-hidden="true" />
    </div>
  );
}
