import { campfireText } from '../lib/today.ts';
import { Icon } from './Icon.tsx';

/** "Campfire: 6 days" with the flame icon. */
export function CampfireChip({ current }: { current: number }) {
  return (
    <span className="chip cat-orange" data-testid="campfire">
      <Icon name="flame" size={18} />
      <span>{campfireText(current)}</span>
    </span>
  );
}
