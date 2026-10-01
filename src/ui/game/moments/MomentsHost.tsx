'use client';
import { useGame } from '@/game/store';
import { GraduationScene } from './GraduationScene';
import { HireScene } from './HireScene';
import { useMoments } from './momentsStore';
import { OfflineReport } from './OfflineReport';
import { UnlockCards } from './UnlockCards';
import { UnlockCeremony } from './UnlockCeremony';

/** Shows the offline report first, then the queued ceremonies one at a time. Quick unlock cards wait for a free screen. */
export function MomentsHost() {
  const offline = useGame((store) => store.offlineReport);
  const current = useMoments((store) => store.queue[0]);
  const dismiss = useMoments((store) => store.dismiss);

  let scene = null;
  if (offline) {
    scene = <OfflineReport report={offline} />;
  } else if (current) {
    const close = () => dismiss(current.id);
    scene =
      current.kind === 'hire' ? (
        <HireScene key={current.id} professor={current.professor} onClose={close} />
      ) : current.kind === 'graduate' ? (
        <GraduationScene key={current.id} diplomas={current.diplomas} onClose={close} />
      ) : (
        <UnlockCeremony key={current.id} moment={current} onClose={close} />
      );
  }

  return (
    <>
      {scene}
      {scene ? null : <UnlockCards />}
    </>
  );
}
