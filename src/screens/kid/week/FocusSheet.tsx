import { useId, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Category, Goal } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { Sheet } from '../../../components/Sheet.tsx';
import { activeCount, MAX_FOCUS } from '../../../lib/week.ts';
import './FocusSheet.css';

export interface FocusSheetProps {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  /** The Monday of the week whose focus this is. */
  week: string;
  /** The week's focus goals (active and done), from weekFocus(). */
  goals: Goal[];
  categories: Category[];
  reload: () => Promise<void>;
  onClose: () => void;
}

/** "Focus for this week": rename, mark done, remove, add. At most three active. */
export function FocusSheet({ api, childId, week, goals, categories, reload, onClose }: FocusSheetProps) {
  const id = useId();
  const { run, busy, error } = useAction(reload);
  const [names, setNames] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const full = activeCount(goals) >= MAX_FOCUS;

  const save = (goal: Parameters<Api['saveGoal']>[1]) => run(() => api.saveGoal(childId, goal));
  const nameOf = (g: Goal) => names[g.id] ?? g.title;

  const rename = (e: FormEvent, g: Goal) => {
    e.preventDefault();
    const next = nameOf(g).trim();
    if (!next || next === g.title) return;
    void save({ id: g.id, title: next }).then(() => setNames(({ [g.id]: _, ...rest }) => rest));
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    void save({ scope: 'week', period_start: week, title: t, category_id: category || null })
      .then((r) => { if (r) { setTitle(''); setCategory(''); } });
  };

  return (
    <Sheet title="Focus for this week" onClose={onClose}>
      <p className="focussheet-hint">Agreed at the Sunday check-in. It can change every week.</p>
      {goals.length > 0 && (
        <ul className="focussheet-list">
          {goals.map((g) => {
            const done = g.status === 'done';
            return (
              <li key={g.id} className="focussheet-item" data-status={g.status}>
                <form className="focussheet-rename" onSubmit={(e) => rename(e, g)}>
                  <label className="sr-only" htmlFor={`${id}-${g.id}`}>Focus: {g.title}</label>
                  <input
                    id={`${id}-${g.id}`} type="text" maxLength={120} value={nameOf(g)}
                    onChange={(e) => setNames((n) => ({ ...n, [g.id]: e.target.value }))}
                  />
                  <button
                    type="submit" className="btn btn-small"
                    disabled={busy || !nameOf(g).trim() || nameOf(g).trim() === g.title}
                  >
                    Rename
                  </button>
                </form>
                <div className="focussheet-buttons">
                  <button
                    type="button" className="btn btn-small" aria-pressed={done} disabled={busy || (done && full)}
                    onClick={() => void save({ id: g.id, status: done ? 'active' : 'done' })}
                  >
                    {done ? 'Done' : 'Mark done'}
                  </button>
                  <button
                    type="button" className="btn btn-small" disabled={busy}
                    aria-label={`Remove ${g.title}`}
                    onClick={() => void save({ id: g.id, status: 'dropped' })}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {full ? (
        <p className="focussheet-full">Three is plenty. Finish or remove one to add another.</p>
      ) : (
        <form className="focussheet-add" onSubmit={add}>
          <div className="focussheet-field">
            <label htmlFor={`${id}-new`}>New focus</label>
            <input id={`${id}-new`} type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="focussheet-field">
            <label htmlFor={`${id}-cat`}>Category <span className="muted">(optional)</span></label>
            <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>Add focus</button>
        </form>
      )}
      {error !== null && <p role="alert" className="focussheet-error">{errorText(error)}</p>}
    </Sheet>
  );
}
