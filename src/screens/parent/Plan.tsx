import { useId, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useParentChild, useSession } from '../../app/session.tsx';
import { useCategories } from '../../app/useCategories.ts';
import { useLoad } from '../../app/useLoad.ts';
import { ErrorPanel } from '../../components/ErrorPanel.tsx';
import { usePageTitle } from '../../components/usePageTitle.ts';
import { Icon } from '../../components/Icon.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { useToast } from '../../components/Toast.tsx';
import { groupMustDos } from '../../lib/board.ts';
import { addDays, monthName } from '../../lib/dates.ts';
import { groupKey, planWeek } from '../../lib/parentPlan.ts';
import { weekFocus } from '../../lib/week.ts';
import { FocusSheet } from '../kid/week/FocusSheet.tsx';
import { DaysOff } from './plan/DaysOff.tsx';
import { MustDoForm } from './plan/MustDoForm.tsx';
import { MustDoList } from './plan/MustDoList.tsx';
import { MustDoSheet } from './plan/MustDoSheet.tsx';
import { NotePanel } from './plan/NotePanel.tsx';
import './Plan.css';

/** Parent: Must-dos. The week's frame: focus areas, must-dos, days off, and a note. */
export function Plan() {
  usePageTitle('Must-dos');
  const { parentApi, parentMe } = useSession();
  if (!parentMe) throw new Error('Plan needs a signed-in parent');
  const child = useParentChild();
  const id = useId();
  const toast = useToast();
  const [params] = useSearchParams();
  const { week, redirect } = planWeek(params.get('week'), parentMe.today);
  const [dialog, setDialog] = useState<{ kind: 'focus' } | { kind: 'add' } | { kind: 'group'; key: string } | null>(null);

  const board = useLoad(() => parentApi.getBoard(child.id, week, addDays(week, 6)), [child.id, week]);
  const today = useLoad(() => parentApi.getToday(child.id), [child.id]);
  const cats = useCategories(parentApi);

  if (redirect) return <Navigate to={redirect} replace />;

  const loads = [board, today, cats.library];
  const failed = loads.find((l) => l.error);
  const reloadAll = () => { for (const l of loads) void l.reload(); };
  const reload = async () => { await Promise.all(loads.map((l) => l.reload())); };

  const head = (
    <div className="plan-head">
      <div className="plan-titles">
        <h1 className="plan-title">Week of {monthName(week).split(' ')[0]} {Number(week.slice(8))}</h1>
        <p className="plan-sub">You set the must-dos. {child.name} plans everything else.</p>
      </div>
      <div className="plan-arrows">
        <Link to={`/parent/plan?week=${addDays(week, -7)}`} className="btn plan-arrow" aria-label="Previous week">
          <Icon name="left" />
        </Link>
        <Link to={`/parent/plan?week=${addDays(week, 7)}`} className="btn plan-arrow" aria-label="Next week">
          <Icon name="right" />
        </Link>
      </div>
    </div>
  );

  const errorPanel = failed && (
    <ErrorPanel error={failed.error} onRetry={reloadAll} />
  );

  if (!board.data || !today.data || !cats.library.data) {
    return <>{head}{errorPanel || <p className="muted">Loading...</p>}</>;
  }

  const b = board.data;
  const focus = weekFocus(b.goals, week);
  const stack = b.pool.filter((c) => c.place === 'week' && c.week_start === week);
  const groups = groupMustDos([...b.cards, ...stack]);
  const openGroup = dialog?.kind === 'group' ? groups.find((g) => groupKey(g) === dialog.key) : undefined;

  return (
    <>
      {head}
      {errorPanel}

      <section className="panel plan-panel" aria-labelledby={`${id}-focus`}>
        <div className="plan-panelhead">
          <h2 id={`${id}-focus`} className="plan-paneltitle">Focus areas (up to three)</h2>
          <button type="button" className="btn" onClick={() => setDialog({ kind: 'focus' })}>Edit</button>
        </div>
        {focus.length === 0 ? (
          <p className="muted plan-empty">No focus yet. Agree on up to three at the Sunday check-in.</p>
        ) : (
          <ul className="plan-chips">
            {focus.map((g) => {
              const cat = g.category_id ? cats.byId.get(g.category_id) : undefined;
              const done = g.status === 'done';
              return (
                <li
                  key={g.id} className={`chip plan-chip ${g.category_id ? cats.colorClass(g.category_id) : 'cat-slate'}`}
                  data-status={g.status}
                >
                  <Icon name={done ? 'check' : cat?.icon ?? 'star'} size={16} />
                  {cat && <span className="sr-only">{cat.name}:</span>}
                  <span className="plan-chiptitle">{g.title}</span>
                  {done && <span className="sr-only">(done)</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <MustDoList
        groups={groups} cats={cats} onAdd={() => setDialog({ kind: 'add' })}
        onOpen={(g) => setDialog({ kind: 'group', key: groupKey(g) })}
      />
      <DaysOff api={parentApi} childId={child.id} role="parent" week={week} marks={b.day_marks} reload={reload} />
      <NotePanel
        api={parentApi} childId={child.id} role="parent" today={parentMe.today}
        todayNote={today.data.parent_note} reload={reload}
      />

      {dialog?.kind === 'focus' && (
        <FocusSheet
          api={parentApi} childId={child.id} role="parent" week={week} goals={focus} categories={cats.categories}
          reload={reload} onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'add' && (
        <Sheet title="Add a must-do" onClose={() => setDialog(null)}>
          <MustDoForm
            api={parentApi} childId={child.id} role="parent" week={week} categories={cats.categories} items={cats.items}
            colorClass={cats.colorClass} reload={reload} onCancel={() => setDialog(null)}
            onDone={() => {
              toast.show(`Added. ${child.name} will see it on his board.`);
              setDialog(null);
            }}
          />
        </Sheet>
      )}
      {openGroup && (
        <MustDoSheet
          api={parentApi} childId={child.id} role="parent" group={openGroup} cats={cats} reload={reload}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
