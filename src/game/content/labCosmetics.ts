/**
 * Art keys for the Laboratório's decoration objects and starting items. Names and art only: effects, prices and
 * the shop are added elsewhere. Art lives in public/assets (hi-res, see the `lab-decor` and `lab-start` sheets).
 */
export interface LabCosmeticArt {
  id: string;
  name: string;
  /** Asset key relative to public/assets, without extension. */
  art: string;
}

const decor = (id: string, name: string): LabCosmeticArt => ({ id, name, art: `lab/decor/${id}` });
const start = (id: string, name: string): LabCosmeticArt => ({ id, name, art: `lab/start/${id}` });

export const labDecor: LabCosmeticArt[] = [
  decor('poster-funciona-na-minha-maquina', 'Pôster "Funciona na minha máquina"'),
  decor('caneca-do-plantao', 'Caneca do Plantão'),
  decor('luz-neon-codigo', 'Luz neon "</>"'),
  decor('lixeira-reciclagem', 'Lixeira de reciclagem'),
  decor('gato-dormindo-no-monitor', 'Gato dormindo no monitor'),
  decor('luminaria', 'Luminária'),
  decor('quadro-branco-diagrama', 'Quadro branco com diagrama'),
  decor('pilha-de-livros-de-algoritmos', 'Pilha de livros de algoritmos'),
  decor('trofeu-de-hackathon', 'Troféu de hackathon'),
  decor('cacto', 'Cacto'),
  decor('fones-pendurados', 'Fones pendurados'),
  decor('mini-servidor', 'Mini servidor com LEDs'),
];

export const labStartItems: LabCosmeticArt[] = [
  start('mouse-dourado', 'Mouse dourado'),
  start('mouse-com-fita-colorida', 'Mouse com fita colorida'),
  start('mouse-de-bolinha', 'Mouse de bolinha'),
  start('trackball', 'Trackball'),
  start('teclado-de-membrana-velho', 'Teclado de membrana velho'),
  start('mousepad-gamer-rgb', 'Mousepad gamer RGB'),
];
