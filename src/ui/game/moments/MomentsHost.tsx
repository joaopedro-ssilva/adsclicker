'use client';
import { useGame } from '@/game/store';
import { HackathonInviteScene } from '@/ui/hackathon/arena/HackathonInviteScene';
import { GraduationScene } from './GraduationScene';
import { HireScene } from './HireScene';
import { useMoments } from './momentsStore';
import { OfflineReport } from './OfflineReport';
import { UnlockCards } from './UnlockCards';
import { UnlockCeremony } from './UnlockCeremony';
import { useJournal } from './journalStore';
import { WhatsNew } from './WhatsNew';
import { useJournalDriver } from './patchNotes';

/**
 * Shows the offline report first, then the queued ceremonies one at a time, then the Jornal do Campus (which
 * opens by itself for a new patch and from the stage button).
 * Quick unlock cards wait for a free screen.
 */
export function MomentsHost() {
  const offline = useGame((store) => store.offlineReport);
  const current = useMoments((store) => store.queue[0]);
  const dismiss = useMoments((store) => store.dismiss);
  const journalOpen = useJournal((store) => store.open);
  const closeJournal = useJournal((store) => store.close);
  useJournalDriver(!offline && !current);

  let scene = null;
  if (offline) {
    scene = <OfflineReport report={offline} />;
  } else if (current) {
    const close = () => dismiss(current.id);
    scene =
      current.kind === 'hire' ? (
        <HireScene key={current.id} professor={current.professor} onClose={close} />
      ) : current.kind === 'hackathon' ? (
        <HackathonInviteScene key={current.id} onClose={close} />
      ) : current.kind === 'graduate' ? (
        <GraduationScene key={current.id} diplomas={current.diplomas} onClose={close} />
      ) : (
        <UnlockCeremony key={current.id} moment={current} onClose={close} />
      );
  } else if (journalOpen) {
    scene = <WhatsNew onClose={closeJournal} />;
  }

  return (
    <>
      {scene}
      {scene ? null : <UnlockCards />}
    </>
  );
}
