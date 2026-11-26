import type { Stats } from '../../../api/types.ts';
import { percentDone } from '../../../lib/board.ts';
import { closedOfCounted } from '../../../lib/month.ts';
import './WeekTiles.css';

interface Props {
  /** getStats for the shown week (Monday to Sunday). */
  stats: Stats;
  today: string;
}

/** Three tiles: percent of planned time done, days closed out, must-dos done. */
export function WeekTiles({ stats, today }: Props) {
  const t = stats.totals;
  const { closed, counted } = closedOfCounted(stats.by_day, today);
  const tiles = [
    { id: 'pct', value: `${percentDone(t.planned_min, t.spent_min)}%`, text: 'of planned time done' },
    { id: 'closed', value: `${closed} of ${counted}`, text: 'days closed out' },
    { id: 'must', value: `${t.must_done} of ${t.must_planned}`, text: 'must-dos done' },
  ];
  return (
    <ul className="weektiles" aria-label="This week in numbers">
      {tiles.map((tile) => (
        <li key={tile.id} className="weektiles-tile" data-testid={`tile-${tile.id}`}>
          <span className="weektiles-value">{tile.value}</span>
          <span className="weektiles-text">{tile.text}</span>
        </li>
      ))}
    </ul>
  );
}
