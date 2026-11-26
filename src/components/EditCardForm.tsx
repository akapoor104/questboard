import { useId, useState, type FormEvent } from 'react';
import type { Card, CardPatch, Category } from '../api/types.ts';
import './EditCardForm.css';

export interface EditCardFormProps {
  card: Card;
  categories: Category[];
  busy?: boolean;
  onSave: (patch: CardPatch) => void;
  onCancel: () => void;
}

/** Change a card's title, category, minutes and details. Sends only what changed. */
export function EditCardForm({ card, categories, busy, onSave, onCancel }: EditCardFormProps) {
  const id = useId();
  const [title, setTitle] = useState(card.title);
  const [category, setCategory] = useState(card.category_id);
  const [minutes, setMinutes] = useState(String(card.minutes));
  const [details, setDetails] = useState(card.details ?? '');

  const mins = Number(minutes);
  const minutesOk = Number.isInteger(mins) && mins >= 5 && mins <= 480;
  const titleOk = title.trim().length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!titleOk || !minutesOk) return;
    const patch: CardPatch = {};
    if (title.trim() !== card.title) patch.title = title.trim();
    if (category !== card.category_id) patch.category_id = category;
    if (mins !== card.minutes) patch.minutes = mins;
    if ((details.trim() || null) !== card.details) patch.details = details.trim() || null;
    onSave(patch);
  };

  // A category that is no longer active still shows, so the select never lies.
  const options = categories.some((c) => c.id === card.category_id) ? categories
    : [...categories, { id: card.category_id, name: 'Other' } as Category];

  return (
    <form className="editcard" onSubmit={submit} noValidate>
      <div className="editcard-field">
        <label htmlFor={`${id}-title`}>Title</label>
        <input
          id={`${id}-title`} type="text" value={title} maxLength={120} required
          aria-invalid={!titleOk} onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="editcard-field">
        <label htmlFor={`${id}-cat`}>Category</label>
        <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value)}>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="editcard-field">
        <label htmlFor={`${id}-min`}>Minutes</label>
        <input
          id={`${id}-min`} type="number" inputMode="numeric" min={5} max={480} step={5} value={minutes}
          aria-invalid={!minutesOk} aria-describedby={`${id}-minhint`} onChange={(e) => setMinutes(e.target.value)}
        />
        <span id={`${id}-minhint`} className="editcard-hint">From 5 to 480 minutes.</span>
      </div>
      <div className="editcard-field">
        <label htmlFor={`${id}-details`}>Details <span className="muted">(optional)</span></label>
        <textarea id={`${id}-details`} rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <div className="editcard-buttons">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !titleOk || !minutesOk}>Save</button>
      </div>
    </form>
  );
}
