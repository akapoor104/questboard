import { useId, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { errorText } from '../../app/errors.ts';
import { useParentChild, useSession } from '../../app/session.tsx';
import { useCategories } from '../../app/useCategories.ts';
import { useLoad } from '../../app/useLoad.ts';
import { CardSheet } from '../../components/CardSheet.tsx';
import { CategoryBar } from '../../components/CategoryBar.tsx';
import { Icon } from '../../components/Icon.tsx';
import { addDays, monday } from '../../lib/dates.ts';
import { parentWeek, weekRangeText } from '../../lib/parentHome.ts';
import { LoadCheck } from './home/LoadCheck.tsx';
import { NeedsYou } from './home/NeedsYou.tsx';
import { WeekTiles } from './home/WeekTiles.tsx';
import './Home.css';

const ANSWERS = [
  { key: 'keep', label: 'Keep' },
  { key: 'change', label: 'Change' },
  { key: 'stop', label: 'Stop' },
  { key: 'start', label: 'Start' },
] as const;

/** Parent: This week. What needs a parent now, and how the shown week went. */
export function Home() {
  const { parentApi, parentMe } = useSession();
  if (!parentMe) throw new Error('Home needs a signed-in parent');
  const child = useParentChild();
  const id = useId();
  const [params] = useSearchParams();
  const { week, redirect } = parentWeek(params.get('week'), parentMe.today);
  const thisMonday = monday(parentMe.today);
  const [openId, setOpenId] = useState<string | null>(null);

  // "Needs you" is about now, whichever week is shown: it always reads this week's board.
  const board = useLoad(() => parentApi.getBoard(child.id, thisMonday, addDays(thisMonday, 6)), [child.id, thisMonday]);
  const stats = useLoad(() => parentApi.getStats(child.id, week, addDays(week, 6)), [child.id, week]);
  const settings = useLoad(() => parentApi.getSettings(), []);
  const review = useLoad(() => parentApi.getReview(child.id, week), [child.id, week]);
  const cats = useCategories(parentApi);

  if (redirect) return <Navigate to={redirect} replace />;

  const loads = [board, stats, settings, review, cats.library];
  const failed = loads.find((l) => l.error);
  const reloadAll = () => { for (const l of loads) void l.reload(); };
  const reload = async () => { await Promise.all(loads.map((l) => l.reload())); };

  const head = (
    <div className="phome-head">
      <div className="phome-titles">
        <h1 className="phome-title">{child.name}'s week</h1>
        <p className="phome-range">{weekRangeText(week)}</p>
      </div>
      <div className="phome-arrows">
        <Link to={`/parent?week=${addDays(week, -7)}`} className="btn phome-arrow" aria-label="Previous week">
          <Icon name="left" />
        </Link>
        <Link to={`/parent?week=${addDays(week, 7)}`} className="btn phome-arrow" aria-label="Next week">
          <Icon name="right" />
        </Link>
      </div>
    </div>
  );

  const errorPanel = failed && (
    <div className="panel page-actions">
      <p role="alert" className="page-error">{errorText(failed.error)}</p>
      <button type="button" className="btn" onClick={reloadAll}>Try again</button>
    </div>
  );

  // getReview answers null for "no check-in", so "not loaded yet" is data null while still loading.
  const reviewMissing = review.data === null && review.loading;
  if (!board.data || !stats.data || !settings.data || reviewMissing || !cats.library.data) {
    return <>{head}{errorPanel || <p className="muted">Loading...</p>}</>;
  }

  const b = board.data;
  const s = stats.data;
  const threshold = settings.data.catchup_alert_threshold ?? 0;
  const guide = settings.data.structured_weekly_max_min ?? s.structured_weekly_max_min;
  const all = [...b.drop_requests, ...b.cards, ...b.pool, ...b.tray, ...b.unconfirmed];
  const sheetCard = openId === null ? undefined : all.find((c) => c.id === openId);
  const rows = cats.categories
    .map((c) => ({ category: c, row: s.by_category.find((r) => r.category_id === c.id) }))
    .filter((x) => x.row && (x.row.planned_min > 0 || x.row.spent_min > 0))
    .map((x) => ({ category: x.category, planned: x.row!.planned_min, spent: x.row!.spent_min }));
  const scale = Math.max(0, ...rows.map((r) => Math.max(r.planned, r.spent)));
  const r = review.data;

  return (
    <>
      {head}
      {errorPanel}
      <NeedsYou
        api={parentApi} childId={child.id} role="parent" board={b} threshold={threshold} reload={reload}
        onOpenCard={(card) => setOpenId(card.id)}
      />
      <WeekTiles stats={s} today={parentMe.today} />
      <LoadCheck plannedMin={s.totals.structured_planned_min} guideMin={guide} />

      <section className="panel phome-panel" aria-labelledby={`${id}-cat`}>
        <div className="phome-panelhead">
          <h2 id={`${id}-cat`} className="phome-paneltitle">Time by category</h2>
          <p className="phome-hint">solid spent, pale planned</p>
        </div>
        {rows.length === 0 ? (
          <p className="muted phome-empty">Nothing planned this week yet.</p>
        ) : (
          <ul className="phome-bars">
            {rows.map((row) => (
              <li key={row.category.id}>
                <CategoryBar
                  category={row.category} colorClass={cats.colorClass(row.category.id)} plannedMin={row.planned}
                  spentMin={row.spent} scaleMin={scale}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel phome-panel" aria-labelledby={`${id}-rev`}>
        <h2 id={`${id}-rev`} className="phome-paneltitle">Check-in</h2>
        {r ? (
          <>
            <dl className="phome-answers">
              {ANSWERS.map((a) => (
                <div key={a.key} className="phome-answer">
                  <dt className="label">{a.label}</dt>
                  <dd>{r[a.key] ?? <span className="muted">Nothing written.</span>}</dd>
                </div>
              ))}
            </dl>
            {r.notes && <p className="phome-notes"><span className="label">Notes</span> {r.notes}</p>}
          </>
        ) : (
          <p className="muted phome-empty">No check-in notes for this week yet.</p>
        )}
      </section>

      {sheetCard && (
        <CardSheet
          key={sheetCard.id} card={sheetCard} board={b} role="parent" api={parentApi} reload={reload}
          onClose={() => setOpenId(null)} cats={cats} settings={parentMe} timeZone={parentMe.timezone}
        />
      )}
    </>
  );
}
