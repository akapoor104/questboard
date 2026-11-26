import { useEffect, useId, useState } from 'react';
import type { Api } from '../../../api/client.ts';
import type { DayMark } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { weekDates } from '../../../lib/board.ts';
import { weekdayName } from '../../../lib/dates.ts';
import { markLabel, nextMark } from '../../../lib/parentPlan.ts';
import './DaysOff.css';

interface Props {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  /** The Monday of the shown week. */
  week: string;
  marks: DayMark[];
  reload: () => Promise<void>;
}

/** "Days off": each press moves a day through none, Rest, Away, none. */
export function DaysOff({ api, childId, week, marks, reload }: Props) {
  const id = useId();
  const { run, busy, error } = useAction(reload);
  const [refocus, setRefocus] = useState<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (busy || !refocus) return;
    if (refocus.isConnected) refocus.focus();
    setRefocus(null);
  }, [busy, refocus]);
  return (
    <section className="panel daysoff" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="daysoff-title">Days off</h2>
      <div className="daysoff-days">
        {weekDates(week).map((date) => {
          const mark = marks.find((m) => m.date === date)?.kind ?? null;
          return (
            <button
              key={date} type="button" className="daysoff-day" data-mark={mark ?? 'none'} disabled={busy}
              aria-label={markLabel(weekdayName(date), mark)}
              onClick={(e) => {
                // The button is disabled while saving, which drops focus: put it back for the next press.
                const button = e.currentTarget;
                void run(() => api.setDayMark(childId, date, nextMark(mark))).then(() => setRefocus(button));
              }}
            >
              <span>{weekdayName(date, true)}</span>
              {mark && <span>{mark === 'rest' ? 'Rest' : 'Away'}</span>}
            </button>
          );
        })}
      </div>
      <p className="daysoff-hint">On Rest and Away days the campfire is safe.</p>
      {error !== null && <p role="alert" className="daysoff-error">{errorText(error)}</p>}
    </section>
  );
}
