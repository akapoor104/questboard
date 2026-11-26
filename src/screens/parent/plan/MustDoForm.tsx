import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Category, LibraryItem } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { Icon } from '../../../components/Icon.tsx';
import { mustDoCards } from '../../../lib/parentPlan.ts';
import { newCardProblem } from '../../../lib/week.ts';
import { LibraryPanel } from '../../kid/week/LibraryPanel.tsx';
import './MustDoForm.css';

export interface MustDoFormProps {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  /** The Monday of the week the must-do goes into. */
  week: string;
  categories: Category[];
  items: LibraryItem[];
  colorClass: (categoryId: string) => string;
  reload: () => Promise<void>;
  /** Called after the cards were added. */
  onDone: () => void;
  onCancel: () => void;
}

const TIMES = [1, 2, 3, 4, 5, 6, 7];

/** "Add a must-do": title (or one from the Library), category, minutes, how many times, due by. */
export function MustDoForm(props: MustDoFormProps) {
  const { api, childId, role, week, categories, items, colorClass, reload, onDone, onCancel } = props;
  const id = useId();
  const { run, busy, error } = useAction(reload);
  const [picking, setPicking] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]?.id ?? '');
  const [minutes, setMinutes] = useState('30');
  const [times, setTimes] = useState('1');
  const [due, setDue] = useState('');
  const [checked, setChecked] = useState(false);
  /** A save is on its way: a second quick press must not add the cards twice. */
  const sending = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  /** Where focus goes after switching between the form and the picker (the pressed button is gone). */
  const focusNext = useRef<'back' | 'pick' | 'title' | null>(null);

  useEffect(() => {
    const to = focusNext.current;
    focusNext.current = null;
    if (to === 'back') backRef.current?.focus();
    if (to === 'pick') pickRef.current?.focus();
    if (to === 'title') titleRef.current?.focus();
  }, [picking]);

  const mins = Number(minutes);
  const problem = newCardProblem(title, mins);

  const showPicker = (on: boolean) => {
    focusNext.current = on ? 'back' : 'pick';
    setPicking(on);
  };
  const pick = (item: LibraryItem) => {
    setTitle(item.title);
    if (categories.some((c) => c.id === item.category_id)) setCategory(item.category_id);
    setMinutes(String(item.minutes));
    focusNext.current = 'title';
    setPicking(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    setChecked(true);
    if (problem === 'title') return titleRef.current?.focus();
    if (problem === 'minutes') return minutesRef.current?.focus();
    sending.current = true;
    try {
      const cards = mustDoCards(
        { title: title.trim(), category_id: category, minutes: mins, times: Number(times), due_date: due || null }, week);
      const added = await run(() => api.addCards(childId, cards));
      if (added) onDone();
    } finally {
      sending.current = false;
    }
  };

  if (picking) {
    return (
      <div className="mustdoform-picker">
        <button ref={backRef} type="button" className="btn btn-small" onClick={() => showPicker(false)}>
          <Icon name="left" size={16} />Back to the must-do
        </button>
        <LibraryPanel
          api={api} childId={childId} role={role} week={week} categories={categories} items={items}
          colorClass={colorClass} past={false} reload={reload} onNewCard={() => undefined} onPick={pick}
        />
      </div>
    );
  }

  const titleBad = checked && problem === 'title';
  const minutesBad = checked && problem === 'minutes';

  return (
    <form className="mustdoform" onSubmit={(e) => void submit(e)} noValidate>
      <div className="mustdoform-field">
        <label htmlFor={`${id}-title`}>Title</label>
        <div className="mustdoform-titlerow">
          <input
            ref={titleRef} id={`${id}-title`} type="text" value={title} maxLength={120} required
            aria-invalid={titleBad} aria-describedby={titleBad ? `${id}-titlehint` : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button ref={pickRef} type="button" className="btn btn-small" onClick={() => showPicker(true)}>
            Pick from the Library
          </button>
        </div>
        {titleBad && <span id={`${id}-titlehint`} className="mustdoform-problem">Give it a short title.</span>}
      </div>
      <div className="mustdoform-field">
        <label htmlFor={`${id}-cat`}>Category</label>
        <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="mustdoform-pair">
        <div className="mustdoform-field">
          <label htmlFor={`${id}-min`}>Minutes</label>
          <input
            ref={minutesRef} id={`${id}-min`} type="number" inputMode="numeric" min={5} max={480} step={5}
            value={minutes} aria-invalid={minutesBad} aria-describedby={`${id}-minhint`}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <div className="mustdoform-field">
          <label htmlFor={`${id}-times`}>How many times this week?</label>
          <select id={`${id}-times`} value={times} onChange={(e) => setTimes(e.target.value)}>
            {TIMES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <span id={`${id}-minhint`} className={minutesBad ? 'mustdoform-problem' : 'mustdoform-hint'}>
        Minutes: from 5 to 480, in steps of 5.
      </span>
      <div className="mustdoform-field">
        <label htmlFor={`${id}-due`}>Due by (optional)</label>
        <input
          id={`${id}-due`} type="date" value={due} min={week}
          onChange={(e) => setDue(e.target.value)}
        />
      </div>
      {error !== null && <p role="alert" className="mustdoform-error">{errorText(error)}</p>}
      <div className="mustdoform-buttons">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>Add</button>
      </div>
    </form>
  );
}
