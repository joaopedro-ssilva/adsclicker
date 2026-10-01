import { useGame } from '@/game/store';
import type { BuyAmount } from '@/game/engine/state';
import { Button } from '@/ui/kit';
import { audio } from '@/ui/audio';

const OPTIONS: { value: BuyAmount; label: string }[] = [
  { value: 1, label: '×1' },
  { value: 10, label: '×10' },
  { value: 'max', label: 'Máx' },
];

/** The x1 / x10 / máx switch (Bruna B2's bulkBuy layer). */
export function BuyAmountSelector() {
  const amount = useGame((store) => store.state.buyAmount);
  const setBuyAmount = useGame((store) => store.setBuyAmount);

  return (
    <div className="buy-amount" role="group" aria-label="Quantidade por compra">
      {OPTIONS.map((option) => (
        <Button
          key={String(option.value)}
          size="sm"
          variant="secondary"
          aria-pressed={amount === option.value}
          data-qa={`buy-amount-${option.value}`}
          onClick={() => {
            audio.play('uiTap');
            setBuyAmount(option.value);
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
