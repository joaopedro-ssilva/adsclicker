import { content } from '@/game/content';
import type { ProfessorId } from '@/game/content/types';
import { hackathonContent } from '@/hackathon/content';
import type { FeedItem } from '@/shared/api';
import { skinById } from '../../shared/characterProps';

/** What the player did, without the name: "formou a 3ª turma". */
export function feedAction(item: FeedItem): string {
  switch (item.kind) {
    case 'joined':
      return 'entrou para a turma';
    case 'allProfessors':
      return 'completou o elenco';
    case 'graduation':
      return item.detail && /^\d+$/.test(item.detail) ? `formou a ${item.detail}ª turma` : 'formou uma turma';
    case 'hire': {
      const professor = item.detail ? content.professors[item.detail as ProfessorId] : undefined;
      return professor ? `contratou ${professor.name.startsWith('Bruna') ? 'a' : 'o'} ${professor.name}` : 'contratou um professor';
    }
    case 'skin': {
      const skin = item.detail ? skinById(item.detail) : undefined;
      return skin ? `ganhou a skin ${skin.name}` : 'ganhou uma skin nova';
    }
    case 'item': {
      const base = item.detail ? hackathonContent.items.find((entry) => entry.id === item.detail) : undefined;
      return base ? `encontrou ${base.name} lendário no Hackathon` : 'encontrou um item lendário no Hackathon';
    }
    case 'promotion': {
      const cargo = item.detail ? hackathonContent.cargos.find((entry) => entry.id === item.detail) : undefined;
      return cargo ? `foi promovido a ${cargo.name} no Hackathon` : 'foi promovido no Hackathon';
    }
  }
}
