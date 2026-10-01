import { useGame } from '@/game/store';
import type { UnlockSubject } from './unlockInfo';

/** "Equipar agora": wear the new thing. A new skin also puts its professor on stage, when they are hired. */
export function equipUnlock(subject: UnlockSubject): void {
  const store = useGame.getState();
  if (subject.item === 'skin') {
    store.equipSkin(subject.def.id);
    if (store.state.hired[subject.def.professor]) store.setActiveProfessor(subject.def.professor);
  } else if (subject.item === 'scenery') {
    store.equipScenery(subject.def.id);
  } else {
    store.equipTheme(subject.def.id);
  }
}
