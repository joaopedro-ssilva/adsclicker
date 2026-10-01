import { Character } from '@/ui/art/Character';
import { Scenery } from '@/ui/art/Scenery';
import { Badge } from '@/ui/kit';
import { ambientLabels, ambientPalettes, ambients, defaultSkin, proceduralSceneries, realSceneries } from '../data';
import { SceneryCard } from '../parts/SceneryCard';
import { SectionHeading } from '../parts/SectionHeading';

const STAGE_GUESTS = ['edecio', 'gladimir'] as const;
const GUEST_FALLBACK_PALETTE = { primary: '#d83a40', secondary: '#2f4f8f', accent: '#f2f2f2' };

export function ScenerySection() {
  return (
    <section className="kit-section" aria-labelledby="cenarios">
      <SectionHeading id="cenarios" number="05" title="O campus respira" note="Arte de verdade, fundos procedurais e nove atmosferas." />

      <h3 className="subsection">Arte pronta</h3>
      <div className="scenery-grid scenery-grid-large">
        {realSceneries.map((scenery, index) => {
          const guest = STAGE_GUESTS[index % STAGE_GUESTS.length] ?? 'edecio';
          const skin = defaultSkin(guest);
          return (
            <SceneryCard key={scenery.id} scenery={scenery}>
              <div className="scenery-guest">
                <Character
                  body={skin?.body}
                  head={`heads/${guest}`}
                  palette={skin?.palette ?? GUEST_FALLBACK_PALETTE}
                  seed={guest}
                  scale={2}
                  label="Professor no cenário"
                />
              </div>
            </SceneryCard>
          );
        })}
      </div>

      <h3 className="subsection">Fundos procedurais, a partir da paleta de cada cenário</h3>
      <div className="scenery-grid">
        {proceduralSceneries.map((scenery) => (
          <SceneryCard key={scenery.id} scenery={scenery} />
        ))}
      </div>

      <h3 className="subsection">Os nove ambientes de partículas</h3>
      <div className="scenery-grid scenery-grid-ambient">
        {ambients.map((ambient) => (
          <Scenery
            key={ambient}
            className="scenery-card"
            scenery={{ id: `ambient-${ambient}`, palette: ambientPalettes[ambient] }}
            ambient={ambient}
          >
            <div className="scenery-card-label">
              <Badge>{ambientLabels[ambient]}</Badge>
            </div>
          </Scenery>
        ))}
      </div>
    </section>
  );
}
