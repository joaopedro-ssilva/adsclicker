'use client';
import { audio } from '@/ui/audio';
import { registerLogoClick } from '../wiring/logoSecret';

/** The game's name. Ten quick clicks on it are a secret. */
export function Logo() {
  return (
    <button
      type="button"
      className="stage-logo"
      aria-label="ADSClicker"
      onClick={() => {
        audio.play('uiTap');
        registerLogoClick();
      }}
    >
      <span className="stage-logo-mark" aria-hidden="true" />
      <span className="stage-logo-text" aria-hidden="true">
        ADS<b>Clicker</b>
      </span>
    </button>
  );
}
