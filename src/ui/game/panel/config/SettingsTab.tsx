import { About } from './About';
import { ResetZone } from './ResetZone';
import { SaveTools } from './SaveTools';
import { SoundSettings } from './SoundSettings';
import { Statistics } from './Statistics';
import { VisualSettings } from './VisualSettings';

export function SettingsTab() {
  return (
    <div className="settings">
      <SoundSettings />
      <VisualSettings />
      <Statistics />
      <SaveTools />
      <ResetZone />
      <About />
    </div>
  );
}
