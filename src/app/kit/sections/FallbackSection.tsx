import { Character } from '@/ui/art/Character';
import { Panel } from '@/ui/kit';
import { defaultSkin, fallbackSkins } from '../data';
import { Lineup } from '../parts/Lineup';
import { SectionHeading } from '../parts/SectionHeading';

const SCALES = [1, 2, 3];

/** Skins without art draw procedurally. Both lineups below are what the game shows for those skins. */
export function FallbackSection() {
  const sample = fallbackSkins[0];
  const sampleDefault = sample ? defaultSkin(sample.professor) : undefined;

  return (
    <section className="kit-section" aria-labelledby="fallback">
      <SectionHeading id="fallback" number="04" title="Sem arte? Sem problema" note="O jogo nunca depende dos arquivos de imagem." />

      <Panel>
        <p className="field-label">Corpo procedural com a cabeça de verdade · o caso das skins que ainda não têm arte</p>
        <Lineup skins={fallbackSkins} realHeads />
      </Panel>

      <Panel>
        <p className="field-label">Tudo procedural · cabeça pela semente, corpo e chapéu pela paleta da skin</p>
        <Lineup skins={fallbackSkins} realHeads={false} />
      </Panel>

      {sample && sampleDefault ? (
        <Panel>
          <p className="field-label">Escala inteira · 1x, 2x e 3x, sempre com pixels nítidos</p>
          <div className="scale-row">
            {SCALES.map((scale) => (
              <figure key={scale}>
                <Character
                  body={sampleDefault.body}
                  head={`heads/${sampleDefault.professor}`}
                  palette={sampleDefault.palette}
                  seed={sampleDefault.id}
                  scale={scale}
                  label={`Escala ${scale}x`}
                />
                <figcaption>{scale}x</figcaption>
              </figure>
            ))}
            {SCALES.map((scale) => (
              <figure key={`procedural-${scale}`}>
                <Character
                  body={sample.body}
                  hat={sample.hat}
                  palette={sample.palette}
                  seed={sample.id}
                  scale={scale}
                  label={`Procedural ${scale}x`}
                />
                <figcaption>{scale}x</figcaption>
              </figure>
            ))}
          </div>
        </Panel>
      ) : null}
    </section>
  );
}
