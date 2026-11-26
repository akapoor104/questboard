import { Link, Navigate, useParams } from 'react-router-dom';
import { errorText } from '../../app/errors.ts';
import { useChild, useSession } from '../../app/session.tsx';
import { useCategories } from '../../app/useCategories.ts';
import { useLoad } from '../../app/useLoad.ts';
import { Icon } from '../../components/Icon.tsx';
import { addDays, firstOfMonth, lastOfMonth, monday, monthName } from '../../lib/dates.ts';
import { boardLine, daysOnBoard, monthParam, parseMonth, shiftMonth } from '../../lib/month.ts';
import { CheckInPanel } from './month/CheckInPanel.tsx';
import { DayGrid } from './month/DayGrid.tsx';
import { GoalsPanel } from './month/GoalsPanel.tsx';
import { StatTiles } from './month/StatTiles.tsx';
import { TimeByCategory } from './month/TimeByCategory.tsx';
import './Month.css';

/** His month: goals, the numbers so far, where the time went, a calendar, and the Sunday check-in. */
export function Month() {
  const { api, me } = useSession();
  if (!me) throw new Error('Month needs an unlocked device');
  const child = useChild();
  const params = useParams();
  const parsed = params.month === undefined ? firstOfMonth(me.today) : parseMonth(params.month);
  const first = parsed ?? firstOfMonth(me.today);
  const last = lastOfMonth(first);
  const soFar = last < me.today ? last : me.today;          // do not count the future
  const week = monday(me.today);

  const whole = useLoad(() => api.getStats(child.id, first, last), [child.id, first]);           // the calendar
  const done = useLoad(() => (first > me.today ? Promise.resolve(null)
    : api.getStats(child.id, first, soFar)), [child.id, first, soFar]);                         // tiles and bars
  const board = useLoad(() => api.getBoard(child.id, first, last), [child.id, first]);           // goals
  const review = useLoad(async () => {
    const current = await api.getReview(child.id, week);
    const latest = current ?? await api.getReview(child.id, addDays(week, -7));
    return { current, latest };
  }, [child.id, week]);
  const cats = useCategories();

  if (parsed === null) return <Navigate to="/month" replace />;

  const loads = [whole, done, board, review, cats.library];
  const failed = loads.find((l) => l.error);
  const reloadAll = () => { for (const l of loads) void l.reload(); };
  const reload = async () => { await Promise.all(loads.map((l) => l.reload())); };
  const future = first > me.today;
  const thisMonth = firstOfMonth(me.today);

  const errorPanel = failed && (
    <div className="panel page-actions">
      <p role="alert" className="page-error">{errorText(failed.error)}</p>
      <button type="button" className="btn" onClick={reloadAll}>Try again</button>
    </div>
  );

  const head = (
    <div className="month-titlerow">
      <Link to={`/month/${monthParam(shiftMonth(first, -1))}`} className="btn month-arrow" aria-label="Previous month">
        <Icon name="left" />
      </Link>
      <h1 className="month-title">{monthName(first)}</h1>
      <Link to={`/month/${monthParam(shiftMonth(first, 1))}`} className="btn month-arrow" aria-label="Next month">
        <Icon name="right" />
      </Link>
      {first !== thisMonth && <Link to="/month" className="month-back">This month</Link>}
    </div>
  );

  if (!whole.data || (!future && !done.data) || !board.data || !review.data || !cats.library.data) {
    return (
      <main className="page month-page">
        {head}
        {errorPanel || <p className="muted">Loading...</p>}
      </main>
    );
  }

  const soFarStats = future ? null : done.data;

  return (
    <main className="page month-page">
      {errorPanel}
      <div className="month-top">
        <div className="month-head">
          {head}
          <p className="month-line">
            {soFarStats ? boardLine(daysOnBoard(soFarStats.by_day)) : 'This month has not started yet. Goals and plans can go in now.'}
          </p>
        </div>
        <GoalsPanel
          api={api} childId={child.id} role="kid" first={first} goals={board.data.goals} categories={cats.categories}
          reload={reload}
        />
      </div>

      {soFarStats && <StatTiles stats={soFarStats} today={me.today} />}

      <div className="month-mid">
        {soFarStats && <TimeByCategory stats={soFarStats} cats={cats} />}
        <DayGrid first={first} days={whole.data.by_day} today={me.today} />
      </div>

      <CheckInPanel
        api={api} childId={child.id} role="kid" week={week} current={review.data.current} latest={review.data.latest}
        reload={reload}
      />
    </main>
  );
}
