import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import type { Board, Card } from '../../api/types.ts';
import { useChild, useSession } from '../../app/session.tsx';
import { useTodayData } from '../../app/TodayProvider.tsx';
import { useCategories } from '../../app/useCategories.ts';
import { useCardDrop } from '../../app/useDrag.ts';
import { useLoad } from '../../app/useLoad.ts';
import { ErrorPanel } from '../../components/ErrorPanel.tsx';
import { usePageTitle } from '../../components/usePageTitle.ts';
import { CardSheet } from '../../components/CardSheet.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { useToast } from '../../components/Toast.tsx';
import { structuredMinutes, weekDates } from '../../lib/board.ts';
import { addDays, monday, weekdayName } from '../../lib/dates.ts';
import { splitPool } from '../../lib/today.ts';
import { weekFocus, weekFromParam, weekPlaceDays } from '../../lib/week.ts';
import { DayColumn } from './week/DayColumn.tsx';
import { FocusChips } from './week/FocusChips.tsx';
import { FocusSheet } from './week/FocusSheet.tsx';
import { LibraryPanel } from './week/LibraryPanel.tsx';
import { LoadMeter } from './week/LoadMeter.tsx';
import { NewCardForm } from './week/NewCardForm.tsx';
import { WeekStack } from './week/WeekStack.tsx';
import './Week.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

/** The newest copy of a card in the board, wherever it now sits. */
function findCard(b: Board, id: string): Card | undefined {
  for (const list of [b.cards, b.pool, b.tray, b.unconfirmed, b.drop_requests]) {
    const c = list.find((x) => x.id === id);
    if (c) return c;
  }
  return undefined;
}

/** His week: seven days, the focus, the load check, the stack and the Library. */
export function Week() {
  usePageTitle('Week');
  const { api, me } = useSession();
  if (!me) throw new Error('Week needs an unlocked device');
  const child = useChild();
  const toast = useToast();
  const params = useParams();
  const location = useLocation();
  const { week, redirect } = weekFromParam(params.monday, me.today);
  const thisMonday = monday(me.today);

  const board = useLoad(() => api.getBoard(child.id, week, addDays(week, 6)), [child.id, week]);
  const stats = useLoad(() => api.getStats(child.id, week, addDays(week, 6)), [child.id, week]);
  const today = useTodayData();
  const cats = useCategories();
  const [open, setOpen] = useState<Card | null>(null);
  const [dialog, setDialog] = useState<
    { kind: 'focus' } | { kind: 'new'; date: string | null; category: string | null } | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  const reload = async () => {
    await Promise.all([board.reload(), stats.reload(), today.reload(), cats.library.reload()]);
  };
  // Drag and drop (T16): onto a day or back to the stack. A past week has nowhere to drop.
  const weekOver = week < thisMonday;
  const drop = useCardDrop({ api, role: 'kid', today: me.today, stackWeek: weekOver ? null : week, reload, toast });

  const ready = board.data !== null && stats.data !== null && cats.library.data !== null;

  // Under 900px the days are a sideways strip: start it on today.
  useEffect(() => {
    if (!ready || !strip.current) return;
    const el = strip.current.querySelector<HTMLElement>('[data-today="true"]');
    strip.current.scrollLeft = el ? el.offsetLeft - strip.current.offsetLeft : 0;
  }, [ready, week]);

  // /week#library scrolls to the Library once it is drawn.
  useEffect(() => {
    if (ready && location.hash === '#library') document.getElementById('library')?.scrollIntoView();
  }, [ready, location.hash]);

  if (redirect) return <Navigate to={redirect} replace />;

  const loads = [board, stats, cats.library];
  const failed = loads.find((l) => l.error);
  const reloadAll = () => { for (const l of loads) void l.reload(); };

  if (!board.data || !stats.data || !cats.library.data) {
    return (
      <main id="main" className="page week-page">
        {failed ? (
          <ErrorPanel error={failed.error} onRetry={reloadAll} />
        ) : <p className="muted">Loading...</p>}
      </main>
    );
  }

  const b = board.data;
  const past = week < thisMonday;
  const stack = splitPool(b.pool, week).current;
  const planned = stats.data.totals.structured_planned_min + structuredMinutes(stack, cats.categories);
  const focus = weekFocus(b.goals, week);
  const [, m, d] = week.split('-').map(Number);
  const sheetCard = open ? findCard(b, open.id) ?? open : null;

  return (
    <main id="main" className="page week-page">
      {failed && (
        <ErrorPanel error={failed.error} onRetry={reloadAll} />
      )}
      <div className="week-top">
        <div className="week-head">
          <div className="week-titlerow">
            <Link to={`/week/${addDays(week, -7)}`} className="btn week-arrow" aria-label="Previous week">
              <Icon name="left" />
            </Link>
            <h1 className="week-title">Week of {MONTHS[m - 1]} {d}</h1>
            <Link to={`/week/${addDays(week, 7)}`} className="btn week-arrow" aria-label="Next week">
              <Icon name="right" />
            </Link>
            {week !== thisMonday && <Link to="/week" className="week-back">This week</Link>}
          </div>
          <FocusChips goals={focus} cats={cats} onEdit={() => setDialog({ kind: 'focus' })} />
        </div>
        <LoadMeter plannedMin={planned} guideMin={stats.data.structured_weekly_max_min} />
      </div>

      <WeekStack cards={stack} cats={cats} timeZone={me.timezone} onOpen={setOpen} drop={past ? undefined : drop} />

      <div className="week-days" ref={strip}>
        {weekDates(week).map((date) => (
          <DayColumn
            key={date} date={date} today={b.today} cards={b.cards.filter((c) => c.date === date)}
            mark={b.day_marks.find((x) => x.date === date)} cats={cats} timeZone={me.timezone} onOpen={setOpen}
            onAdd={() => setDialog({ kind: 'new', date, category: null })} drop={past ? undefined : drop}
          />
        ))}
      </div>

      <LibraryPanel
        api={api} childId={child.id} role="kid" week={week} categories={cats.categories} items={cats.items}
        colorClass={cats.colorClass} past={past} reload={reload}
        onNewCard={(category) => setDialog({ kind: 'new', date: null, category })}
      />

      {sheetCard && (
        <CardSheet
          key={sheetCard.id} card={sheetCard} board={b} role="kid" api={api} reload={reload} onClose={() => setOpen(null)}
          cats={cats} settings={me} timeZone={me.timezone}
          placeDays={past ? undefined : weekPlaceDays(week, b.today)} stackWeek={past ? thisMonday : week}
        />
      )}
      {dialog?.kind === 'focus' && (
        <FocusSheet
          api={api} childId={child.id} role="kid" week={week} goals={focus} categories={cats.categories}
          reload={reload} onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'new' && (
        <Sheet title="New card" onClose={() => setDialog(null)}>
          <NewCardForm
            api={api} childId={child.id} role="kid" categories={cats.categories}
            to={dialog.date ? { place: 'day', date: dialog.date } : { place: 'week', week_start: week }}
            initialCategory={dialog.category} reload={reload} onCancel={() => setDialog(null)}
            onDone={() => {
              toast.show(dialog.date ? `Added to ${weekdayName(dialog.date)}` : "Added to this week's stack");
              setDialog(null);
            }}
          />
        </Sheet>
      )}
    </main>
  );
}
