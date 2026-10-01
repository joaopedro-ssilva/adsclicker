import { useCallback } from 'react';
import { content, useGame } from '@/game/store';
import { ThemeCard } from './ThemeCard';

export function ThemesSection() {
  const owned = useGame((store) => store.state.themes);
  const equipped = useGame((store) => store.state.equippedTheme);
  const equipTheme = useGame((store) => store.equipTheme);
  const equip = useCallback((id: string) => equipTheme(id), [equipTheme]);

  return (
    <div className="theme-list">
      {content.themes.map((theme) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          owned={owned[theme.id] === true}
          equipped={equipped === theme.id}
          onEquip={equip}
        />
      ))}
    </div>
  );
}
