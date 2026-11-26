import { useId, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Category, Goal } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import './GoalsPanel.css';

export interface GoalsPanelProps {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  /** The first of the month. */
  first: string;
  /** The board's goals; this panel shows the month ones of `first` that are not dropped. */
  goals: Goal[];
  categories: Category[];
  reload: () => Promise<void>;
}

/** "Goals for the month": a checkbox per goal (done = struck through) and "Add a goal". */
export function GoalsPanel({ api, childId, first, goals, categories, reload }: GoalsPanelProps) {
  const id = useId();
  const { run, busy, error } = useAction(reload);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const mine = goals.filter((g) => g.scope === 'month' && g.period_start === first && g.status !== 'dropped');

  const add = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    void run(() => api.saveGoal(childId, { scope: 'month', period_start: first, title: t, category_id: category || null }))
      .then((r) => { if (r) { setTitle(''); setCategory(''); setAdding(false); } });
  };

  return (
    <section className="panel goalspanel" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="label">Goals for the month</h2>
      {mine.length === 0 && <p className="muted goalspanel-empty">No goals yet. Add one or two you want to finish this month.</p>}
      {mine.length > 0 && (
        <ul className="goalspanel-list">
          {mine.map((g) => (
            <li key={g.id} data-status={g.status}>
              <label className="goalspanel-goal">
                <input
                  type="checkbox" checked={g.status === 'done'} disabled={busy}
                  onChange={() => void run(() => api.saveGoal(childId, { id: g.id, status: g.status === 'done' ? 'active' : 'done' }))}
                />
                <span className="goalspanel-title">{g.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form className="goalspanel-add" onSubmit={add}>
          <div className="goalspanel-field">
            <label htmlFor={`${id}-title`}>Goal</label>
            <input
              id={`${id}-title`} type="text" maxLength={120} value={title} autoFocus
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="goalspanel-field">
            <label htmlFor={`${id}-cat`}>Category <span className="muted">(optional)</span></label>
            <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="goalspanel-buttons">
            <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>Save goal</button>
            <button type="button" className="btn" onClick={() => { setAdding(false); setTitle(''); setCategory(''); }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button type="button" className="btn goalspanel-addbtn" onClick={() => setAdding(true)}>Add a goal</button>
        </div>
      )}
      {error !== null && <p role="alert" className="goalspanel-error">{errorText(error)}</p>}
    </section>
  );
}
