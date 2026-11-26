import { useSession, useChild } from '../../app/session.tsx';
import { errorText } from '../../app/errors.ts';
import { useTodayData } from '../../app/TodayProvider.tsx';
import { useCategories } from '../../app/useCategories.ts';
import { useLoad } from '../../app/useLoad.ts';
import { addDays, formatLongDate, monday } from '../../lib/dates.ts';
import { openCount } from '../../lib/today.ts';
import { CloseOutPanel } from './today/CloseOutPanel.tsx';
import { DayTimeline } from './today/DayTimeline.tsx';
import { Reminders } from './today/Reminders.tsx';
import { StackColumn } from './today/StackColumn.tsx';
import { TimeBar } from './today/TimeBar.tsx';
import { TrayColumn } from './today/TrayColumn.tsx';
import { WordPanel } from './today/WordPanel.tsx';
import './Today.css';

/** His Today screen (read-only until T05). */
export function Today() {
  const { api, me } = useSession();
  if (!me) throw new Error('Today needs an unlocked device');
  const child = useChild();
  const week = monday(me.today);
  // Four weeks back, so leftovers can say where they came from and nothing left in an
  // older stack is lost from view. Today's cards are the ones with date === board.today.
  const board = useLoad(() => api.getBoard(child.id, addDays(week, -28), addDays(week, 6)), [child.id, week]);
  const today = useTodayData();
  const cats = useCategories();

  const loads = [board, today, cats.library];
  const reloadAll = () => { for (const l of loads) void l.reload(); };
  const failed = loads.find((l) => l.error);

  if (!board.data || !today.data || !cats.library.data) {
    return (
      <main className="page today-page">
        {failed ? (
          <div className="panel page-actions">
            <p role="alert" className="page-error">{errorText(failed.error)}</p>
            <button type="button" className="btn" onClick={reloadAll}>Try again</button>
          </div>
        ) : <p className="muted">Loading...</p>}
      </main>
    );
  }

  const b = board.data;
  const t = today.data;
  const todayCards = b.cards.filter((c) => c.date === b.today);

  return (
    <main className="page today-page">
      {failed && (
        <div className="panel page-actions today-wide">
          <p role="alert" className="page-error">{errorText(failed.error)}</p>
          <button type="button" className="btn" onClick={reloadAll}>Try again</button>
        </div>
      )}
      <div className="today">
        <div className="today-head">
          <div>
            <h1 className="today-title">{formatLongDate(b.today)}</h1>
            <p className="today-cheer" data-testid="encouragement">{t.encouragement ?? 'One card at a time.'}</p>
          </div>
          {t.parent_note && (
            <div className="panel today-note">
              <span className="label">A note from Mom or Dad</span>
              <p>{t.parent_note}</p>
            </div>
          )}
          <TimeBar cards={todayCards} cats={cats} />
        </div>
        {t.word && <div className="today-word"><WordPanel word={t.word} /></div>}
        <div className="today-alerts"><Reminders alerts={t.alerts} board={b} /></div>
        <div className="today-stack">
          <StackColumn pool={b.pool} week={week} cats={cats} timeZone={me.timezone} />
        </div>
        <div className="today-day">
          <DayTimeline
            cards={todayCards} dayStartMin={me.day_start_min} dayEndMin={me.day_end_min} cats={cats} timeZone={me.timezone}
          />
        </div>
        <div className="today-side">
          <TrayColumn tray={b.tray} cards={b.cards} cats={cats} timeZone={me.timezone} />
          <CloseOutPanel open={openCount(b.cards, b.today)} closed={b.closeouts.some((c) => c.date === b.today)} />
        </div>
      </div>
    </main>
  );
}
