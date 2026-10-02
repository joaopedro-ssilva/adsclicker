import { CommitIcon } from './CommitIcon';
import { whole } from './labels';

/** An amount of Commits with the coin mark. */
export function Commits({ amount, size = 12 }: { amount: number; size?: number }) {
  return (
    <span className="hk-price">
      <CommitIcon size={size} />
      {whole(amount)}
    </span>
  );
}
