import { useId, useRef, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Category, NewCard } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { useToast } from '../../../components/Toast.tsx';
import { newCardProblem } from '../../../lib/week.ts';
import './NewCardForm.css';

export interface NewCardFormProps {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  categories: Category[];
  /** Where the card goes: the stack of a week, or one day. */
  to: { place: 'week'; week_start: string } | { place: 'day'; date: string };
  /** The category it starts on (the Library's filter), if any. */
  initialCategory?: string | null;
  reload: () => Promise<void>;
  /** Called after the card was added. */
  onDone: () => void;
  onCancel: () => void;
}

/** "New card": title, category, minutes, and "Keep it in my Library". Checked before sending. */
export function NewCardForm({ api, childId, categories, to, initialCategory, reload, onDone, onCancel }: NewCardFormProps) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error } = useAction(reload);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(
    initialCategory && categories.some((c) => c.id === initialCategory) ? initialCategory : categories[0]?.id ?? '');
  const [minutes, setMinutes] = useState('30');
  const [keep, setKeep] = useState(false);
  const [checked, setChecked] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);

  const mins = Number(minutes);
  const problem = newCardProblem(title, mins);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setChecked(true);
    if (problem === 'title') return titleRef.current?.focus();
    if (problem === 'minutes') return minutesRef.current?.focus();
    const t = title.trim();
    const card: NewCard = to.place === 'week'
      ? { title: t, category_id: category, minutes: mins, place: 'week', week_start: to.week_start }
      : { title: t, category_id: category, minutes: mins, place: 'day', date: to.date };
    const added = await run(() => api.addCards(childId, [card]));
    if (!added) return;
    // The card is in. A library problem must not make a retry add the card twice.
    if (keep) {
      try {
        await api.saveLibraryItem({ title: t, category_id: category, minutes: mins });
        await reload();
      } catch (err) {
        toast.showError(err);
      }
    }
    onDone();
  };

  const titleBad = checked && problem === 'title';
  const minutesBad = checked && problem === 'minutes';

  return (
    <form className="newcard" onSubmit={(e) => void submit(e)} noValidate>
      <div className="newcard-field">
        <label htmlFor={`${id}-title`}>Title</label>
        <input
          ref={titleRef} id={`${id}-title`} type="text" value={title} maxLength={120} required
          aria-invalid={titleBad} aria-describedby={titleBad ? `${id}-titlehint` : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
        {titleBad && <span id={`${id}-titlehint`} className="newcard-problem">Give it a short title.</span>}
      </div>
      <div className="newcard-field">
        <label htmlFor={`${id}-cat`}>Category</label>
        <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="newcard-field">
        <label htmlFor={`${id}-min`}>Minutes</label>
        <input
          ref={minutesRef} id={`${id}-min`} type="number" inputMode="numeric" min={5} max={480} step={5} value={minutes}
          aria-invalid={minutesBad} aria-describedby={`${id}-minhint`} onChange={(e) => setMinutes(e.target.value)}
        />
        <span id={`${id}-minhint`} className={minutesBad ? 'newcard-problem' : 'newcard-hint'}>
          From 5 to 480 minutes, in steps of 5.
        </span>
      </div>
      <label className="newcard-check">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        <span>Keep it in my Library</span>
      </label>
      {error !== null && <p role="alert" className="newcard-error">{errorText(error)}</p>}
      <div className="newcard-buttons">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>Add card</button>
      </div>
    </form>
  );
}
