import { useId } from 'react';
import type { Card, DayMark } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { CardTile } from '../../../components/CardTile.tsx';
import { Icon } from '../../../components/Icon.tsx';
import { formatDuration, formatLongDate, weekdayName } from '../../../lib/dates.ts';
import { dayPlannedMinutes } from '../../../lib/week.ts';
import './DayColumn.css';

interface Props {
  date: string;
  today: string;
  /** The day's cards, in the server's order (timed first by time, then any time). */
  cards: Card[];
  mark: DayMark | undefined;
  cats: Categories;
  timeZone: string;
  onOpen: (card: Card) => void;
  /** Opens the new-card form for this day. Past days have none. */
  onAdd?: () => void;
}

/** One day of the week: header, marks, its cards as rows, and an add button. */
export function DayColumn({ date, today, cards, mark, cats, timeZone, onOpen, onAdd }: Props) {
  const id = useId();
  const isToday = date === today;
  const past = date < today;
  const name = formatLongDate(date);
  return (
    <section
      className="daycol" aria-label={name} data-today={isToday ? 'true' : undefined} data-past={past ? 'true' : undefined}
      data-mark={mark?.kind}
    >
      <div className="daycol-head">
        <h3 id={`${id}-title`} className="daycol-title">{weekdayName(date, true)} {Number(date.slice(8))}</h3>
        <span className="daycol-total">{formatDuration(dayPlannedMinutes(cards))}</span>
      </div>
      {isToday && <span className="label daycol-today">Today</span>}
      {mark && (
        <div className="daycol-mark">
          <span className="daycol-chip">{mark.kind === 'rest' ? 'Rest day' : 'Away'}</span>
          {mark.note && <p className="daycol-note">{mark.note}</p>}
        </div>
      )}
      {cards.length > 0 ? (
        <ul className="daycol-list">
          {cards.map((c) => (
            <li key={c.id}>
              <CardTile
                card={c} category={cats.byId.get(c.category_id)} colorClass={cats.colorClass(c.category_id)}
                variant="row" timeZone={timeZone} onOpen={() => onOpen(c)}
              />
            </li>
          ))}
        </ul>
      ) : !mark && <p className="daycol-empty">Nothing planned.</p>}
      {onAdd && !past && (
        <button type="button" className="daycol-add" aria-label={`Add a card to ${weekdayName(date)}`} onClick={onAdd}>
          <Icon name="plus" size={18} />
        </button>
      )}
    </section>
  );
}
