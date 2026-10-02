import type { HeadDef } from './types';

const head = (id: string, name: string): HeadDef => ({ id, name, asset: `hackathon/heads/${id}` });

/** 6 masculine and 6 feminine presentations; the art team draws each one (see the final report). */
export const heads: HeadDef[] = [
  head('cacheado', 'Cabelo cacheado'),
  head('oculos-redondos', 'Óculos redondos'),
  head('topete', 'Topete alto'),
  head('black-power', 'Black power'),
  head('barba-ruiva', 'Barba ruiva'),
  head('raspado', 'Cabeça raspada'),
  head('trancas', 'Tranças longas'),
  head('coque', 'Coque no alto'),
  head('franja-oculos', 'Franja e óculos'),
  head('cabelo-rosa', 'Cabelo rosa'),
  head('cacho-longo', 'Cachos soltos'),
  head('chanel', 'Corte chanel'),
];
