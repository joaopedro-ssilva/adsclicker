import type { ThemeDef } from './types';

/** HUD colour themes (Bruna B2). Colours only. Text pairs are checked for contrast in content.test.ts. */
export const themes: ThemeDef[] = [
  {
    id: 'escuro',
    name: 'Padrão Escuro',
    description: 'O visual de sempre: fundo escuro, texto claro e destaque na cor do professor.',
    default: true,
    colors: {
      bg: '#12121c',
      surface: '#1b1b2b',
      surfaceRaised: '#26263a',
      border: '#3a3a56',
      text: '#f2f2f8',
      textMuted: '#a9a9c4',
    },
  },
  {
    id: 'claro',
    name: 'Claro',
    description: 'Fundo claro e texto escuro, para jogar de dia sem apertar os olhos.',
    colors: {
      bg: '#f4f1ea',
      surface: '#ffffff',
      surfaceRaised: '#ebe6da',
      border: '#b9b19c',
      text: '#1d1b26',
      textMuted: '#5b5666',
    },
  },
  {
    id: 'alto-contraste',
    name: 'Alto Contraste',
    description: 'Preto e branco puros com bordas fortes. Máxima leitura em qualquer tela.',
    colors: {
      bg: '#000000',
      surface: '#0a0a0a',
      surfaceRaised: '#1a1a1a',
      border: '#ffffff',
      text: '#ffffff',
      textMuted: '#e0e0e0',
    },
  },
  {
    id: 'terminal',
    name: 'Terminal Verde',
    description: 'Letras verdes em fundo preto. Digite "sudo" com o olhar.',
    colors: {
      bg: '#020a04',
      surface: '#06140a',
      surfaceRaised: '#0c2112',
      border: '#1f7a3a',
      text: '#33ff66',
      textMuted: '#22c455',
    },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    description: 'Tons suaves de rosa e lilás. Um semestre mais fofo.',
    colors: {
      bg: '#fff6fb',
      surface: '#ffffff',
      surfaceRaised: '#f3e8ff',
      border: '#cdb4e6',
      text: '#3b2f4a',
      textMuted: '#6a5a7d',
    },
  },
];
