import { useId, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Review, ReviewInput } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import './CheckInForm.css';

export interface CheckInFormProps {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  /** The Monday of the week this check-in is for. */
  week: string;
  /** That week's saved check-in, to start from; null for a new one. */
  review: Review | null;
  reload: () => Promise<void>;
  onCancel: () => void;
  onDone: () => void;
}

type Field = keyof Required<ReviewInput>;

export const CHECK_IN_FIELDS: { key: Field; label: string; prompt: string; max: number }[] = [
  { key: 'keep', label: 'Keep', prompt: 'What worked that I want to keep doing?', max: 2000 },
  { key: 'change', label: 'Change', prompt: 'What should work differently next week?', max: 2000 },
  { key: 'stop', label: 'Stop', prompt: 'What should I stop doing or planning?', max: 2000 },
  { key: 'start', label: 'Start', prompt: 'What is one new thing to try?', max: 2000 },
  { key: 'notes', label: 'Notes', prompt: 'Anything Mom or Dad and I agreed.', max: 4000 },
];

/** The four answers plus notes. Saving always sends all five fields (a missing one would be cleared). */
export function CheckInForm({ api, childId, week, review, reload, onCancel, onDone }: CheckInFormProps) {
  const id = useId();
  const { run, busy, error } = useAction(reload);
  const [values, setValues] = useState<Record<Field, string>>({
    keep: review?.keep ?? '', change: review?.change ?? '', stop: review?.stop ?? '', start: review?.start ?? '',
    notes: review?.notes ?? '',
  });

  const save = (e: FormEvent) => {
    e.preventDefault();
    const clean = (v: string) => (v.trim() ? v.trim() : null);
    const body = {
      keep: clean(values.keep), change: clean(values.change), stop: clean(values.stop), start: clean(values.start),
      notes: clean(values.notes),
    };
    void run(() => api.saveReview(childId, week, body)).then((r) => { if (r !== undefined) onDone(); });
  };

  return (
    <form className="checkinform" onSubmit={save}>
      {CHECK_IN_FIELDS.map((f) => (
        <div key={f.key} className="checkinform-field">
          <label htmlFor={`${id}-${f.key}`}>{f.label}</label>
          <p id={`${id}-${f.key}-p`} className="checkinform-prompt">{f.prompt}</p>
          <textarea
            id={`${id}-${f.key}`} aria-describedby={`${id}-${f.key}-p`} rows={f.key === 'notes' ? 3 : 2}
            maxLength={f.max} value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        </div>
      ))}
      {error !== null && <p role="alert" className="checkinform-error">{errorText(error)}</p>}
      <div className="checkinform-buttons">
        <button type="submit" className="btn btn-primary" disabled={busy}>Save check-in</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
