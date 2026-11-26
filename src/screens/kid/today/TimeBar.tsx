import type { Card } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { Icon } from '../../../components/Icon.tsx';
import { minutesByCategory } from '../../../lib/board.ts';
import { formatDuration } from '../../../lib/dates.ts';
import './TimeBar.css';

/** Today's planned and spent time, as one stacked bar with a legend. */
export function TimeBar({ cards, cats }: { cards: Card[]; cats: Categories }) {
  const rows = minutesByCategory(cards, cats.categories).filter((r) => r.planned > 0);
  const planned = rows.reduce((s, r) => s + r.planned, 0);
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const name = (id: string) => cats.byId.get(id)?.name ?? 'Other';
  return (
    <section className="panel timebar" aria-labelledby="timebar-title">
      <div className="timebar-head">
        <h2 id="timebar-title" className="timebar-title">Today's time</h2>
        <span className="muted">{formatDuration(planned)} planned</span>
        <span className="muted">{formatDuration(spent)} done so far</span>
      </div>
      {rows.length > 0 && (
        <>
          <div
            className="timebar-bar" role="img"
            aria-label={`Planned minutes today by category: ${rows.map((r) => `${name(r.category_id)} ${r.planned}`).join(', ')}`}
          >
            {rows.map((r) => (
              <span key={r.category_id} className={`timebar-seg ${cats.colorClass(r.category_id)}`} style={{ flexGrow: r.planned }} />
            ))}
          </div>
          <ul className="timebar-legend">
            {rows.map((r) => (
              <li key={r.category_id} className={`timebar-key ${cats.colorClass(r.category_id)}`}>
                <span className="timebar-swatch"><Icon name={cats.byId.get(r.category_id)?.icon ?? 'star'} size={14} /></span>
                {name(r.category_id)} {r.planned}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
