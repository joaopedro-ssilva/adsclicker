import { describe, expect, it } from 'vitest';
import { Decimal } from '../decimal';
import { bolsaInvestedLabel } from './views';

describe('bolsaInvestedLabel', () => {
  it('prints plain zeros and spells the unit out, never a bare "Oc" (the 1e27 suffix)', () => {
    const label = bolsaInvestedLabel({ invested: new Decimal(0), limit: new Decimal(0), limitMinutes: 2 });
    expect(label).toBe('0 / 0 ADScoins (2 min de produção)');
    expect(label).not.toMatch(/\bOc\b/);
  });

  it('gives each amount its own suffix', () => {
    const label = bolsaInvestedLabel({ invested: new Decimal(1500), limit: new Decimal('2.5e6'), limitMinutes: 10 });
    expect(label).toBe('1.500 / 2,5 M ADScoins (10 min de produção)');
  });
});
