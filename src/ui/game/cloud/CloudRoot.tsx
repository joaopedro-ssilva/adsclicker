'use client';
import { useEffect } from 'react';
import { useCloud } from '@/game/cloud';
import { CloudToasts } from './CloudToasts';
import { ConflictDialog } from './ConflictDialog';

/** Mounted once the game is ready: starts the background sync and hosts what the cloud can put on screen. */
export function CloudRoot() {
  useEffect(() => {
    useCloud.getState().start();
    return () => useCloud.getState().stop();
  }, []);

  return (
    <>
      <ConflictDialog />
      <CloudToasts />
    </>
  );
}
