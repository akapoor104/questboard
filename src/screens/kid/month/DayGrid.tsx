import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { StatsDay } from '../../../api/types.ts';
import { Icon } from '../../../components/Icon.tsx';
import { monthGrid } from '../../../lib/board.ts';
import { formatDuration, monday } from '../../../lib/dates.ts';
import { cellAriaLabel, dayLabel, shortDuration, tintStep } from '../../../lib/month.ts';
import './DayGrid.css';

interface Props {
  /** The first of the month. */
  first: string;
  /** by_day of getStats for the whole month (future days included). */
  days: StatsDay[];
  today: string;
}

const HEADS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Text that has a long form and a short one for narrow screens. */
function Both({ long, short }: { long: string; short: string }) {
  return (
    <>
      <span className="daygrid-long">{long}</span>
      <span className="daygrid-short">{short}</span>
    </>
  );
}

/** "Day by day": a Monday-first month calendar. Each day links to its week. */
export function DayGrid({ first, days, today }: Props) {
  const id = useId();
  const month = first.slice(0, 7);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const maxSpent = Math.max(0, ...days.map((d) => d.spent_min));

  return (
    <section className="panel daygrid" aria-labelledby={`${id}-h`}>
      <div className="daygrid-head">
        <h2 id={`${id}-h`} className="daygrid-title">Day by day</h2>
        <p className="daygrid-hint">A check means the day was closed out.</p>
      </div>
      <div className="daygrid-grid">
        {HEADS.map((h) => <span key={h} className="daygrid-wd" aria-hidden="true">{h}</span>)}
        {monthGrid(first).flat().map((date) => {
          const n = Number(date.slice(8));
          const day = byDate.get(date);
          if (date.slice(0, 7) !== month || !day) {
            return <span key={date} className="daygrid-out" aria-hidden="true">{n}</span>;
          }
          const label = dayLabel(day, today);
          // Today is still going, and rest or away days have their own grey: neither is tinted.
          const tint = label === 'today' || label === 'rest' || label === 'away' ? 0 : tintStep(day.spent_min, maxSpent);
          return (
            <Link
              key={date} to={`/week/${monday(date)}`} className="daygrid-cell" data-label={label} data-tint={tint}
              data-date={date} aria-label={cellAriaLabel(day, today)}
            >
              <span className="daygrid-top">
                <span className="daygrid-num">{n}</span>
                {day.closed && <span className="daygrid-check"><Icon name="check" size={14} /></span>}
              </span>
              <span className="daygrid-text">
                {label === 'today' && 'Today'}
                {label === 'rest' && <Both long="Rest day" short="Rest" />}
                {label === 'away' && 'Away'}
                {label === 'closed' && day.spent_min > 0
                  && <Both long={formatDuration(day.spent_min)} short={shortDuration(day.spent_min)} />}
                {label === 'not_closed' && 'Not closed'}
                {label === 'planned'
                  && <Both long={`${formatDuration(day.planned_min)} planned`} short={shortDuration(day.planned_min)} />}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="daygrid-legend">Darker blue means more time spent that day.</p>
    </section>
  );
}
