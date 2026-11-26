import { useId, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { useToast } from '../../../components/Toast.tsx';
import { addDays } from '../../../lib/dates.ts';
import './NotePanel.css';

interface Props {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  /** The family's today (from the server). */
  today: string;
  /** Today's note as the server has it now (getToday().parent_note). */
  todayNote: string | null;
  reload: () => Promise<void>;
}

/** "A note he will see": one short note for today or tomorrow. An empty note removes it. */
export function NotePanel({ api, childId, today, todayNote, reload }: Props) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error } = useAction(reload);
  const [which, setWhich] = useState<'today' | 'tomorrow'>('today');
  /** What was typed (or saved) in this visit, by date. Tomorrow cannot be read back from the server. */
  const [texts, setTexts] = useState<Record<string, string>>({});
  const date = which === 'today' ? today : addDays(today, 1);
  const text = texts[date] ?? (which === 'today' ? todayNote ?? '' : '');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    const done = await run(() => api.setParentNote(childId, date, clean || null));
    if (done === undefined) return;
    setTexts((t) => ({ ...t, [date]: clean }));
    toast.show(clean ? `Saved. He will see it ${which}.` : 'Note removed.');
  };

  return (
    <section className="panel notepanel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="notepanel-title">A note he will see</h2>
      <div className="notepanel-when" role="group" aria-label="When">
        <button type="button" className="notepanel-pick" aria-pressed={which === 'today'} onClick={() => setWhich('today')}>
          Today
        </button>
        <button
          type="button" className="notepanel-pick" aria-pressed={which === 'tomorrow'} onClick={() => setWhich('tomorrow')}
        >
          Tomorrow
        </button>
      </div>
      <form className="notepanel-form" onSubmit={(e) => void save(e)}>
        <label htmlFor={`${id}-text`} className="sr-only">Note for {which}</label>
        <input
          id={`${id}-text`} type="text" maxLength={500} value={text}
          placeholder={which === 'today' ? 'A few words for today' : 'A few words for tomorrow'}
          onChange={(e) => setTexts((t) => ({ ...t, [date]: e.target.value }))}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
      </form>
      {error !== null && <p role="alert" className="notepanel-error">{errorText(error)}</p>}
    </section>
  );
}
