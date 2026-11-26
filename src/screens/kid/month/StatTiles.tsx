import type { Stats } from '../../../api/types.ts';
import { formatDuration } from '../../../lib/dates.ts';
import { closedOfCounted } from '../../../lib/month.ts';
import './StatTiles.css';

interface Props {
  /** Stats from the first of the month to today (or the month's end). */
  stats: Stats;
  today: string;
}

/** Five tiles, straight from getStats: finished, partly done, missed, days closed out, time. */
export function StatTiles({ stats, today }: Props) {
  const t = stats.totals;
  const { closed, counted } = closedOfCounted(stats.by_day, today);
  const tiles: { id: string; value: string; text: string }[] = [
    { id: 'finished', value: String(t.done), text: 'cards finished' },
    { id: 'partial', value: String(t.partial), text: 'partly done, carried on' },
    { id: 'missed', value: String(t.missed), text: 'missed' },
    { id: 'closed', value: `${closed} of ${counted}`, text: 'days closed out' },
    { id: 'time', value: formatDuration(t.spent_min), text: `spent of ${formatDuration(t.planned_min)} planned` },
  ];
  return (
    <ul className="stattiles" aria-label="This month in numbers">
      {tiles.map((tile) => (
        <li key={tile.id} className="stattiles-tile" data-testid={`stat-${tile.id}`}>
          <span className="stattiles-value">{tile.value}</span>
          <span className="stattiles-text">{tile.text}</span>
        </li>
      ))}
    </ul>
  );
}
