import { useEffect, useRef } from 'react';
import { useGame } from '@/game/store';
import type { Rarity } from '@/game/content/types';
import { useJournal } from './journalStore';

/** One entry of the Jornal do Campus. */
export interface Patch {
  /** Stable key. Adding a new first entry makes the Jornal open once for everyone who had played. */
  id: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  title: string;
  /** One line that stays visible while the entry is folded. */
  summary: string;
  /** Skins shown on their professors, themes and sceneries by id. */
  skins?: readonly string[];
  sceneries?: readonly string[];
  themes?: readonly string[];
  /** Kept as a silhouette with "???" until the player owns them, so the best ones stay a surprise. */
  secretRarities?: readonly Rarity[];
  secretSceneries?: readonly string[];
  /** Plain-text notes on mechanics and fixes. */
  notes: readonly string[];
  /** A shortcut card to the ranking, with the text beside it. */
  ranking?: { title: string; text: string };
}

/** Newest first. The first one is "the latest patch": the one announced by itself and tracked as unread. */
export const PATCHES: readonly Patch[] = [
  {
    id: '2026-10-recompensas',
    date: '2026-10-13',
    title: 'Novidades na sala!',
    summary: 'Onze skins, quatro cenários e três temas, todos recompensas de conquistas.',
    skins: [
      'wagner-elite',
      'pablo-sensei',
      'edecio-luvas',
      'b2-curadora',
      'gladimir-explorador',
      'b2-look',
      'wagner-cafe',
      'guto-sextou',
      'b1-burndown',
      'angelo-escala',
      'pablo-trader',
    ],
    sceneries: ['cofre', 'aurora', 'sala-de-planning', 'camarim'],
    themes: ['holografico', 'platina', 'prata'],
    secretRarities: ['epic', 'legendary'],
    secretSceneries: ['aurora', 'camarim'],
    notes: [
      'Cada skin, cenário e tema novo é recompensa de uma conquista: o Álbum mostra qual.',
      'As mais raras você descobre jogando.',
    ],
    ranking: {
      title: 'Perfil dos jogadores',
      text: 'Na aba Turma, clique em alguém do ranking para ver o professor em cena, a skin, o cenário e as estatísticas da pessoa.',
    },
  },
  {
    id: '2026-10-ranking',
    date: '2026-10-12',
    title: 'Ranking com cara de gente',
    summary: 'Apelidos, selos e rankings que escondem quem joga sujo.',
    notes: [
      'Para entrar no ranking basta uma conta com apelido e senha.',
      'Alguns jogadores ganham selos (tags) ao lado do apelido, entregues pela coordenação.',
      'Contas suspeitas ficam fora dos rankings por padrão.',
      'O limite de cliques manuais subiu para 100 por segundo.',
      'Mostrar como cada skin, cenário e tema foi conquistado continua valendo depois de ganhar.',
    ],
  },
  {
    id: '2026-10-miticas',
    date: '2026-10-09',
    title: 'Chegaram as míticas',
    summary: 'Uma skin mítica por professor, a maior façanha de cada linha.',
    skins: [
      'edecio-primordial',
      'gladimir-arquivista',
      'b2-prisma',
      'wagner-sentinela',
      'guto-tempestade',
      'b1-imperatriz',
      'angelo-chanceler',
      'pablo-singularidade',
    ],
    secretRarities: ['mythic'],
    notes: [
      'A mítica é a raridade mais alta: no palco ganha brilho rosa e faíscas de pixel (desligadas em "reduzir movimento").',
      'No Álbum, moldura dupla própria.',
      'Cenários, temas e conquistas novas acompanham as míticas, e o ritmo do jogo foi ajustado.',
    ],
  },
  {
    id: '2026-10-maestrias',
    date: '2026-10-09',
    title: 'Maestrias e Monitores',
    summary: 'Depois da primeira Formatura, cada professor ganha uma mecânica só sua.',
    notes: [
      'Maestrias: cada Formatura dá uma vaga, e você escolhe qual professor recebe na aba Formatura. Vale para sempre.',
      'Edécio entra no modo ouro com o combo cheio, Gladimir guarda saltos no tempo, Wagner chama a Super invasão.',
      'Bruna B2 dá níveis de brinde, Guto faz a Festa de lançamento, Bruna B1 lança versões, Angelo conta horas complementares e Pablo abre a Bolsa de tokens.',
      'Monitores: quatro alunos que assumem as tarefas chatas (compras, pesquisa, segurança e sprints), contratados com diplomas e com chave liga/desliga.',
      'O que o monitor faz não conta como você jogando: as conquistas de jogar na mão continuam honestas.',
      'Cada turma agora tem um limite de diplomas, e a aba Formatura ganhou seções que dobram.',
    ],
  },
];

export const LATEST_PATCH = PATCHES[0]!;

const KEY = 'adsclicker.seenPatch';

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(KEY, LATEST_PATCH.id);
  } catch {
    // Without storage the Jornal opens again on the next visit, which is harmless.
  }
}

/**
 * Drives the Jornal do Campus. Decided once per visit: a player who already had progress and has not read the
 * newest patch gets `unread` and, once nothing else is on screen (`free`), the window opens by itself; a
 * brand-new player is marked as read, since everything is new to them. Opening the window, by itself or from the
 * stage button, clears `unread` and remembers the patch on this device.
 */
export function useJournalDriver(free: boolean): void {
  const open = useJournal((store) => store.open);
  const decision = useRef<'seen' | 'show' | 'new-player' | null>(null);
  const announced = useRef(false);

  useEffect(() => {
    if (decision.current !== null) return;
    if (readSeen() === LATEST_PATCH.id) {
      decision.current = 'seen';
      return;
    }
    // The game screen only renders after boot, on the client, so the save is there to read.
    const { counters, lifetimeCoins } = useGame.getState().state;
    if (counters.clicks > 0 || lifetimeCoins.gt(0)) {
      decision.current = 'show';
      useJournal.getState().setUnread(true);
    } else {
      decision.current = 'new-player';
      markSeen();
    }
  }, []);

  useEffect(() => {
    if (decision.current === 'show' && free && !announced.current) {
      announced.current = true;
      useJournal.getState().show();
    }
  }, [free]);

  useEffect(() => {
    if (!open) return;
    announced.current = true;
    markSeen();
    useJournal.getState().setUnread(false);
  }, [open]);
}
