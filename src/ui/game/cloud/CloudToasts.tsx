'use client';
import { useEffect, useRef } from 'react';
import { useCloud } from '@/game/cloud';
import { toast } from '@/ui/kit';
import { FRESH_MEMORY, nextConnectionToast } from './connectionToasts';
import type { ConnectionMemory } from './connectionToasts';

/** One toast when the cloud connection drops and one when it returns. Renders nothing. */
export function CloudToasts() {
  const memory = useRef<ConnectionMemory>(FRESH_MEMORY);

  useEffect(() => {
    const check = () => {
      const { status, unavailable } = useCloud.getState();
      const next = nextConnectionToast(memory.current, status, unavailable);
      memory.current = next.memory;
      if (next.toast === 'lost') {
        toast({ title: 'Sem conexão', description: 'O jogo continua salvando neste aparelho.', tone: 'warn', emoji: '☁️' });
      } else if (next.toast === 'back') {
        toast({ title: 'Conexão de volta', description: 'Seu progresso voltou a ir para a nuvem.', tone: 'good', emoji: '☁️' });
      }
    };
    check();
    return useCloud.subscribe(check);
  }, []);

  return null;
}
