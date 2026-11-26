import { useEffect, useState } from 'react';
import type { Card } from '../../api/types.ts';
import { errorText } from '../../app/errors.ts';
import { useSession } from '../../app/session.tsx';
import { useCategories, type Categories } from '../../app/useCategories.ts';
import { useLoad } from '../../app/useLoad.ts';
import { CampfireChip } from '../../components/CampfireChip.tsx';
import { Icon } from '../../components/Icon.tsx';
import { usePageTitle } from '../../components/usePageTitle.ts';
import { formatClock, formatDuration, formatLongDate, minutesInZone } from '../../lib/dates.ts';
import { isEmpty, markText, nowAndNext, startText } from '../../lib/display.ts';
import './Display.css';

/** The clock moves every 15 seconds; the data reloads once a minute (useLoad). */
const TICK_MS = 15_000;

function useClock(): number {
  const [ms, setMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setMs(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return ms;
}

/** A wall screen: dark by default, and back to what it was when the screen goes away. */
function useDarkTheme(): void {
  useEffect(() => {
    const root = document.documentElement;
    const before = root.dataset.theme;
    root.dataset.theme = 'dark';
    return () => {
      if (before === undefined) delete root.dataset.theme;
      else root.dataset.theme = before;
    };
  }, []);
}

function Category({ id, cats }: { id: string; cats: Categories }) {
  const cat = cats.byId.get(id);
  return (
    <span className="display-cat">
      <Icon name={cat?.icon ?? 'star'} size={28} />
      <span>{cat?.name ?? 'Other'}</span>
    </span>
  );
}

function timeRange(card: Card): string {
  if (card.start_min === null) return formatDuration(card.minutes);
  return `${formatClock(card.start_min)} to ${formatClock(card.start_min + card.minutes)}`;
}

/**
 * The kitchen display: read-only, readable from across the room. No buttons, no links;
 * it only reads (getToday, getBoard, getLibrary) and never calls anything that writes.
 */
export function Display() {
  usePageTitle('Display');
  useDarkTheme();
  const { api, me } = useSession();
  if (!me) throw new Error('Display needs a linked display device');
  const child = me.children[0];
  const childId = child?.id ?? '';
  const ms = useClock();
  const cats = useCategories();
  // getToday first: its date is the server's today, so the screen rolls over at midnight
  // even when it is left open for days.
  const data = useLoad(async () => {
    const today = await api.getToday(childId);
    const board = await api.getBoard(childId, today.date, today.date);
    return { today, board };
  }, [childId]);

  const nowMin = minutesInZone(ms, me.timezone);

  if (!data.data || !cats.library.data) {
    const failed = data.error ?? cats.library.error;
    return (
      <main id="main" className="display">
        <p className="display-tag">Display only</p>
        {failed ? <p role="alert" className="display-error">{errorText(failed)}</p> : <p className="display-muted">Loading...</p>}
      </main>
    );
  }

  const { today: t, board: b } = data.data;
  const cards = b.cards.filter((c) => c.date === b.today);
  const view = nowAndNext(cards, nowMin);
  const mark = b.day_marks.find((m) => m.date === b.today);
  const failed = data.error ?? cats.library.error;

  return (
    <main id="main" className="display">
      <p className="display-tag">Display only</p>
      <header className="display-head">
        <p className="display-clock" data-testid="display-clock">{formatClock(nowMin)}</p>
        <div className="display-headside">
          <h1 className="display-date">{formatLongDate(b.today)}</h1>
          <div className="display-chips">
            <CampfireChip current={t.streak.current} />
            {mark && <span className="chip display-mark" data-testid="day-mark">{markText(mark)}{mark.note ? `: ${mark.note}` : ''}</span>}
          </div>
        </div>
      </header>
      {failed ? <p role="alert" className="display-error">{errorText(failed)}</p> : null}

      {isEmpty(view) ? (
        <p className="display-empty">Nothing on the board right now.</p>
      ) : (
        <div className="display-grid">
          <div className="display-main">
            <section className="display-now" aria-labelledby="display-now-h">
              <h2 id="display-now-h" className="display-label">Now</h2>
              {view.now ? (
                <div className={`display-big ${cats.colorClass(view.now.category_id)}`} data-testid="display-now">
                  <p className="display-now-title">{view.now.title}</p>
                  <p className="display-meta">
                    <Category id={view.now.category_id} cats={cats} />
                    <span>{timeRange(view.now)}</span>
                  </p>
                </div>
              ) : (
                <p className="display-free">Free time</p>
              )}
            </section>
            {view.next && (
              <section className="display-next" aria-labelledby="display-next-h">
                <h2 id="display-next-h" className="display-label">Next</h2>
                <div className={`display-big ${cats.colorClass(view.next.category_id)}`} data-testid="display-next">
                  <p className="display-next-time">{formatClock(view.next.start_min as number)}</p>
                  <p className="display-next-title">{view.next.title}</p>
                  <p className="display-meta"><Category id={view.next.category_id} cats={cats} /></p>
                </div>
              </section>
            )}
          </div>
          {(view.later.length > 0 || view.anytime.length > 0) && (
            <section className="display-rest" aria-labelledby="display-rest-h">
              <h2 id="display-rest-h" className="display-label">Rest of today</h2>
              <ul className="display-list">
                {[...view.later, ...view.anytime].map((c) => (
                  <li key={c.id} className={`display-row ${cats.colorClass(c.category_id)}`}>
                    <span className="display-row-time">{startText(c)}</span>
                    <span className="display-row-icon"><Icon name={cats.byId.get(c.category_id)?.icon ?? 'star'} size={28} /></span>
                    <span className="display-row-title">{c.title}</span>
                    <span className="display-row-cat">{cats.byId.get(c.category_id)?.name ?? 'Other'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {t.word && (
        <section className="display-word" aria-labelledby="display-word-h">
          <h2 id="display-word-h" className="display-label">Word of the day</h2>
          <p>
            <span className="display-word-word">{t.word.word}</span>{' '}
            <span className="display-word-pos">{t.word.part_of_speech}</span>{' '}
            <span className="display-word-def">{t.word.definition}</span>
          </p>
        </section>
      )}
    </main>
  );
}
