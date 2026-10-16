'use client';
import { useMemo, useState } from 'react';
import { useCloud } from '@/game/cloud';
import { donationTitleFor, MIN_DONATION } from '@/game/engine/actions';
import type { Decimal } from '@/game/engine/decimal';
import { formatNumber, parseAmount } from '@/game/engine/format';
import { useCoins } from '@/game/store/hooks';
import { useGame } from '@/game/store/useGame';
import { Button, Icon, toast } from '@/ui/kit';

/** The three quick amounts: shares of the coins in hand. 100% asks for a confirmation. */
const PRESETS = [
  { id: '10', share: 0.1, label: '10%' },
  { id: '50', share: 0.5, label: '50%' },
  { id: '100', share: 1, label: '100%' },
] as const;

type Choice = (typeof PRESETS)[number]['id'] | 'custom';

interface DonateControlsProps {
  /** Called after a donation went through, so the board can be asked again. */
  onDonated: () => void;
}

/** Amount of a choice: a share of the coins in hand, or what was typed (null when it cannot be read). */
function amountOf(choice: Choice, coins: Decimal, custom: string): Decimal | null {
  if (choice === 'custom') return parseAmount(custom);
  const share = PRESETS.find((preset) => preset.id === choice)?.share ?? 0;
  return share >= 1 ? coins : coins.mul(share).floor();
}

export function DonateControls({ onDonated }: DonateControlsProps) {
  const coins = useCoins();
  const [choice, setChoice] = useState<Choice>('10');
  const [custom, setCustom] = useState('');
  const [confirming, setConfirming] = useState(false);

  const amount = useMemo(() => amountOf(choice, coins, custom), [choice, coins, custom]);
  const hasCoins = coins.gte(MIN_DONATION);
  const tooMuch = amount !== null && amount.gt(coins);
  const tooLittle = amount !== null && amount.lt(MIN_DONATION);
  const valid = amount !== null && !tooMuch && !tooLittle;
  // Giving every coin (the 100% share, or a typed amount that equals them) is what asks for a second tap.
  const all = valid && amount.gte(coins);

  const pick = (next: Choice) => {
    setChoice(next);
    setConfirming(false);
  };

  const donate = () => {
    const store = useGame.getState();
    // The coins keep ticking up while the player reads: the all-in share is read again at the moment of the tap.
    const live = amountOf(choice, store.state.coins, custom);
    if (!live || live.lt(MIN_DONATION)) return;
    const before = donationTitleFor(store.state.donated);
    if (!store.donateToCampus(live)) {
      toast({ title: 'Doação não realizada', description: 'Você não tem tantas ADScoins agora.', tone: 'warn' });
      setConfirming(false);
      return;
    }
    const after = donationTitleFor(useGame.getState().state.donated);
    toast({ title: 'Obrigado pela doação!', description: `${formatNumber(live)} ADScoins foram para o campus.`, tone: 'good', emoji: '🏫' });
    if (after && after.id !== before?.id) {
      toast({ title: `Novo título: ${after.name}`, description: after.description, tone: 'good', emoji: after.emoji, duration: 7000 });
    }
    setConfirming(false);
    setCustom('');
    // Send the new total to the board now instead of waiting for the next minute's sync.
    void Promise.resolve(useCloud.getState().syncNow()).then(onDonated, onDonated);
  };

  const hint = !hasCoins
    ? 'Junte pelo menos 1 ADScoin para doar.'
    : choice === 'custom' && custom.trim() !== '' && amount === null
      ? 'Não entendi o valor. Use um número ou uma abreviação, como 5 Qad.'
      : tooMuch
        ? `Você só tem ${formatNumber(coins, { integer: true })} ADScoins.`
        : tooLittle
          ? 'A doação mínima é 1 ADScoin.'
          : null;

  return (
    <div className="cc-donate" data-qa="cc-donate">
      <p className="cc-hand">
        <Icon name="coin" size={16} /> Na mão: <strong>{formatNumber(coins, { integer: true })}</strong> ADScoins
      </p>

      <div className="cc-presets" role="group" aria-label="Quanto doar">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant="secondary"
            aria-pressed={choice === preset.id}
            disabled={!hasCoins}
            data-qa={`cc-preset-${preset.id}`}
            className="cc-preset"
            onClick={() => pick(preset.id)}
          >
            <strong>{preset.label}</strong>
            <span>{hasCoins ? formatNumber(amountOf(preset.id, coins, '') ?? 0, { integer: true }) : '0'}</span>
          </Button>
        ))}
      </div>

      <label className="cc-custom">
        <span>Outro valor</span>
        <input
          className="cc-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Ex.: 5 Qad, 2,5 M ou 1000"
          value={custom}
          disabled={!hasCoins}
          aria-invalid={choice === 'custom' && custom.trim() !== '' && !valid ? true : undefined}
          data-qa="cc-custom-input"
          onFocus={() => pick('custom')}
          onChange={(event) => {
            setCustom(event.target.value);
            pick('custom');
          }}
        />
      </label>

      {hint ? (
        <p className="cc-hint" role="status" data-qa="cc-hint">
          {hint}
        </p>
      ) : null}

      {confirming && valid ? (
        <div className="cc-confirm" role="alertdialog" aria-label="Confirmar doação de todas as ADScoins" data-qa="cc-confirm">
          <p>
            <strong>Doar tudo?</strong> Suas {formatNumber(amount, { integer: true })} ADScoins vão para o campus e você fica sem nada na mão.
          </p>
          <div className="cc-confirm-actions">
            <Button variant="danger" onClick={donate} data-qa="cc-confirm-yes">
              Sim, doar tudo
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} data-qa="cc-confirm-no">
              Voltar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="cc-give"
          size="lg"
          disabled={!valid}
          data-qa="cc-give"
          onClick={() => (all ? setConfirming(true) : donate())}
        >
          <Icon name="plus" size={16} />
          {valid ? `Doar ${formatNumber(amount, { integer: true })}` : 'Doar'}
        </Button>
      )}
    </div>
  );
}
