import { useEffect, useState, type CSSProperties } from 'react';
import type { Card } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { CardTile } from '../../../components/CardTile.tsx';
import { layoutDay } from '../../../lib/board.ts';
import type { CardAction } from '../../../lib/cardActions.ts';
import { formatClock, minutesInZone } from '../../../lib/dates.ts';
import { hourLabel, hourRows, timedBox } from '../../../lib/today.ts';
import './DayTimeline.css';

interface Props {
  /** Today's cards. */
  cards: Card[];
  dayStartMin: number;
  dayEndMin: number;
  cats: Categories;
  timeZone: string;
  /** Opens the card sheet, or one of its forms. */
  onOpen: (card: Card, start?: CardAction) => void;
}

/** Minutes as a length on the timeline: 15 minutes = var(--slot). */
const slots = (min: number) => `calc(${min / 15} * var(--slot))`;

/** The family's clock, re-read every 30 seconds. */
function useNowMinute(timeZone: string): number {
  const [now, setNow] = useState(() => minutesInZone(Date.now(), timeZone));
  useEffect(() => {
    const tick = () => setNow(minutesInZone(Date.now(), timeZone));
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [timeZone]);
  return now;
}

/** Today: the any-time strip, then the day from start to end with timed cards placed side by side. */
export function DayTimeline({ cards, dayStartMin, dayEndMin, cats, timeZone, onOpen }: Props) {
  const { anytime, timed } = layoutDay(cards);
  const now = useNowMinute(timeZone);
  const span = Math.max(dayEndMin - dayStartMin, 15);
  const hours = hourRows(dayStartMin, dayEndMin);
  const showNow = now >= dayStartMin && now <= dayEndMin;
  // The now line keeps its time; an hour label it would touch steps aside.
  const hidden = (h: number) => showNow && Math.abs(now - h) < 20;
  const tile = (card: Card, variant: 'row' | 'timed') => (
    <CardTile
      card={card} category={cats.byId.get(card.category_id)} colorClass={cats.colorClass(card.category_id)}
      variant={variant} timeZone={timeZone} onOpen={() => onOpen(card)}
      actions={card.doing_since !== null && card.status === 'open' ? (
        <button type="button" className="btn btn-small" onClick={() => onOpen(card, 'resolve')}>How did it go?</button>
      ) : undefined}
    />
  );

  return (
    <section className="today-col dayline" aria-labelledby="day-title">
      <div className="today-colhead">
        <h2 id="day-title">Today</h2>
        <span className="muted today-hint">Tap a card to start it or to say how it went</span>
      </div>
      {cards.length === 0 && <p className="today-empty">Nothing planned yet. Pick a card from your stack.</p>}
      {anytime.length > 0 && (
        <div className="panel dayline-any" role="group" aria-labelledby="day-any">
          <span id="day-any" className="label">Any time today</span>
          <ul className="dayline-anylist">
            {anytime.map((c) => <li key={c.id}>{tile(c, 'row')}</li>)}
          </ul>
        </div>
      )}
      <div className="panel dayline-box">
        <div className="dayline-grid" style={{ height: slots(span) }}>
          <div className="dayline-scale" aria-hidden="true">
            {hours.map((h) => (
              <div key={h} className="dayline-hour" style={{ top: slots(Math.max(h - dayStartMin, 0)) }}>
                <span className="dayline-hourlabel" style={hidden(h) ? { visibility: 'hidden' } : undefined}>
                  {hourLabel(h)}
                </span>
              </div>
            ))}
            {showNow && (
              <div className="dayline-now" data-testid="now-line" style={{ top: slots(now - dayStartMin) }}>
                <span className="dayline-nowlabel">{formatClock(now)}</span>
              </div>
            )}
          </div>
          <ul className="dayline-lane">
            {timed.map((t) => {
              const box = timedBox(t.start, t.card.minutes, dayStartMin, dayEndMin);
              const style: CSSProperties = {
                top: slots(box.top), height: slots(box.height),
                left: `${(t.column / t.columns) * 100}%`, width: `${100 / t.columns}%`,
              };
              return <li key={t.card.id} className="dayline-slot" style={style}>{tile(t.card, 'timed')}</li>;
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
