import { useEffect, useId, useRef, useState } from 'react';
import type { Board, Card } from '../api/types.ts';
import { placeDays, suggestStart } from '../lib/cardActions.ts';
import { formatClock, minutesInZone } from '../lib/dates.ts';
import './PlaceForm.css';

/** Where a card goes: a day (and maybe a time), or back to this week's stack. */
export type Place = { place: 'day'; date: string; start_min: number | null } | { place: 'week' };

export interface PlaceFormProps {
  card: Card;
  board: Board;
  /** The family's day, from whoami(). */
  settings: { day_start_min: number; day_end_min: number };
  /** The family's time zone, for "now". */
  timeZone: string;
  /** Offer "This week's stack" as a destination. */
  allowStack: boolean;
  /** The day it starts on (default today). */
  initialDate?: string;
  /** Shows a Save button that hands over the choice. */
  onSave?: (place: Place) => void;
  /** Called with every change (for a form that has its own Save, such as "How did it go?"). */
  onChange?: (place: Place) => void;
  busy?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const hourText = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

/** Pick a day and a time. Starts on the first free slot; overlaps are allowed. */
export function PlaceForm(props: PlaceFormProps) {
  const { card, board, settings, timeZone, allowStack, onSave, busy } = props;
  const id = useId();
  const days = placeDays(board.today);
  const startDay = days.some((d) => d.date === props.initialDate) ? props.initialDate as string : board.today;

  const suggest = (date: string) => suggestStart({
    card, date, today: board.today, nowMin: minutesInZone(Date.now(), timeZone),
    day_start_min: settings.day_start_min, day_end_min: settings.day_end_min,
    dayCards: date >= board.from && date <= board.to ? board.cards.filter((c) => c.date === date) : null,
  });

  const [first] = useState(() => suggest(startDay));
  const [day, setDay] = useState<string>(startDay);           // a date, or 'week'
  const [suggested, setSuggested] = useState<number | null>(first);
  const [time, setTime] = useState<number>(first ?? settings.day_start_min);
  const [anyTime, setAnyTime] = useState(first === null);
  const [touched, setTouched] = useState(false);

  const place: Place = day === 'week' ? { place: 'week' } : { place: 'day', date: day, start_min: anyTime ? null : time };
  const onChange = useRef(props.onChange);
  onChange.current = props.onChange;
  const key = JSON.stringify(place);
  useEffect(() => {
    onChange.current?.(JSON.parse(key) as Place);
  }, [key]);

  const pickDay = (date: string) => {
    setDay(date);
    if (date === 'week' || touched) return;
    const s = suggest(date);
    setSuggested(s);
    if (s === null) setAnyTime(true);
    else {
      setTime(s);
      setAnyTime(false);
    }
  };
  const pickTime = (t: number) => {
    setTime(t);
    setAnyTime(false);
    setTouched(true);
  };
  const mark = (date: string) => board.day_marks.find((m) => m.date === date)?.kind;

  return (
    <div className="placeform">
      <div className="placeform-group">
        <h3 id={`${id}-day`} className="placeform-label">Which day?</h3>
        <div className="placeform-days" role="group" aria-labelledby={`${id}-day`}>
          {days.map((d) => {
            const m = mark(d.date);
            return (
              <button
                key={d.date} type="button" className="placeform-day" aria-pressed={day === d.date}
                onClick={() => pickDay(d.date)}
              >
                {d.label}
                {m && <span className="placeform-mark">{m === 'rest' ? 'Rest' : 'Away'}</span>}
              </button>
            );
          })}
          {allowStack && (
            <button
              type="button" className="placeform-day placeform-stack" aria-pressed={day === 'week'}
              onClick={() => pickDay('week')}
            >
              This week's stack
            </button>
          )}
        </div>
      </div>

      {day !== 'week' && (
        <div className="placeform-group">
          <h3 id={`${id}-time`} className="placeform-label">What time?</h3>
          <div className="placeform-time" role="group" aria-labelledby={`${id}-time`}>
            <button
              type="button" className="placeform-day" aria-pressed={anyTime}
              onClick={() => { setAnyTime(!anyTime); setTouched(true); }}
            >
              Any time
            </button>
            <label className="placeform-select">
              <span className="sr-only">Hour</span>
              <select value={Math.floor(time / 60)} onChange={(e) => pickTime(Number(e.target.value) * 60 + (time % 60))}>
                {HOURS.map((h) => <option key={h} value={h}>{hourText(h)}</option>)}
              </select>
            </label>
            <span aria-hidden="true">:</span>
            <label className="placeform-select">
              <span className="sr-only">Minute</span>
              <select value={time % 60} onChange={(e) => pickTime(Math.floor(time / 60) * 60 + Number(e.target.value))}>
                {MINUTES.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
              </select>
            </label>
          </div>
          <p className="placeform-hint" aria-live="polite">
            {anyTime ? 'Any time that day.'
              : !touched && suggested !== null && time === suggested ? `${formatClock(time)} is free`
                : formatClock(time)}
          </p>
        </div>
      )}

      {onSave && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSave(place)}>Save</button>
      )}
    </div>
  );
}
