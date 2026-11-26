import { useId, useState } from 'react';
import type { Api } from '../api/client.ts';
import type { Board, Card, Category } from '../api/types.ts';
import { errorText } from '../app/errors.ts';
import { useAction } from '../app/useLoad.ts';
import { previewResolve } from '../lib/board.ts';
import { dayName } from '../lib/cardActions.ts';
import { formatClock, formatDuration } from '../lib/dates.ts';
import { Icon } from './Icon.tsx';
import { PercentPicker } from './PercentPicker.tsx';
import { PlaceForm, type Place } from './PlaceForm.tsx';
import { Sheet } from './Sheet.tsx';
import { useToast } from './Toast.tsx';
import './ResolveDialog.css';

type Rest = 'tray' | 'day' | 'let_go';

export interface ResolveDialogProps {
  card: Card;
  board: Board;
  role: 'kid' | 'parent';
  api: Api;
  reload: () => Promise<void>;
  category: Category | undefined;
  colorClass: string;
  settings: { day_start_min: number; day_end_min: number };
  timeZone: string;
  onClose: () => void;
}

/** "How did it go?": the percent, a note, and what happens to the time left. */
export function ResolveDialog(props: ResolveDialogProps) {
  const { card, board, role, api, reload, category, colorClass, settings, timeZone, onClose } = props;
  const id = useId();
  const toast = useToast();
  const { run, busy, error } = useAction(reload);
  const [pct, setPct] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [rest, setRest] = useState<Rest>('tray');
  const [place, setPlace] = useState<Place | null>(null);
  // His must-dos cannot be let go: he asks a parent instead.
  const askParent = role === 'kid' && card.kind === 'must';

  const when = card.place === 'day' && card.date !== null
    ? `${dayName(card.date, board.today)}${card.start_min !== null ? ` ${formatClock(card.start_min)}` : ''} · planned ${formatDuration(card.minutes)}`
    : `planned ${formatDuration(card.minutes)}`;

  const save = async () => {
    if (pct === null) return;
    const text = note.trim() || undefined;
    let dropError: unknown = null;
    const result = await run(async () => {
      if (pct === 100 || rest === 'tray') return api.resolveCard(card.id, pct, { note: text });
      if (rest === 'day') {
        const to = place?.place === 'day' ? place : { date: board.today, start_min: null };
        return api.resolveCard(card.id, pct, { note: text, remainder: 'day', new_date: to.date, new_start_min: to.start_min });
      }
      if (!askParent) return api.resolveCard(card.id, pct, { note: text, remainder: 'let_go' });
      const r = await api.resolveCard(card.id, pct, { note: text });
      if (r.carry) await api.dropCard(r.carry.id, text).catch((e: unknown) => { dropError = e; });
      return r;
    });
    if (!result) return;
    if (dropError) toast.showError(dropError);
    else if (pct < 100 && rest === 'tray' && result.carry) {
      toast.show(`Saved. ${formatDuration(result.carry.minutes)} is in your Catch-up tray.`);
    } else if (pct < 100 && rest === 'let_go' && askParent) toast.show('Saved. A parent will decide about the rest.');
    else toast.show('Saved.');
    onClose();
  };

  return (
    <Sheet title="How did it go?" onClose={onClose}>
      <p className="resolve-sub">Be honest. Half done is still half done.</p>
      <div className={`resolve-card ${colorClass}`}>
        <div className="card-meta">
          <Icon name={category?.icon ?? 'star'} size={16} />
          <span>{category?.name ?? 'Other'}</span>
          <span className="resolve-when">{when}</span>
        </div>
        <p className="resolve-title">{card.title}</p>
      </div>

      <PercentPicker minutes={card.minutes} value={pct} onChange={setPct} disabled={busy} />

      <div className="resolve-field">
        <label htmlFor={`${id}-note`} className="resolve-label">
          {pct === 100 ? 'Anything to remember?' : 'What got in the way?'} <span className="muted">(optional)</span>
        </label>
        <input
          id={`${id}-note`} className="resolve-input" type="text" maxLength={500} value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {pct !== null && pct < 100 && (
        <fieldset className="resolve-rest">
          <legend className="resolve-label">What happens to the time left?</legend>
          {([
            ['tray', 'Put it in my Catch-up tray'],
            ['day', 'Give it a new day and time now'],
            ['let_go', askParent ? 'Ask a parent to let it go' : 'Let it go'],
          ] as const).map(([value, text]) => (
            <label key={value} className="resolve-option">
              <input type="radio" name={`${id}-rest`} value={value} checked={rest === value} onChange={() => setRest(value)} />
              <span>{text}</span>
            </label>
          ))}
          {rest === 'day' && (
            <div className="resolve-place">
              <PlaceForm
                card={{ ...card, minutes: previewResolve(card.minutes, pct).left }} board={board} settings={settings} timeZone={timeZone}
                allowStack={false} onChange={setPlace}
              />
            </div>
          )}
        </fieldset>
      )}

      {error !== null && <p role="alert" className="resolve-error">{errorText(error)}</p>}

      <div className="resolve-buttons">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={pct === null || busy} onClick={() => void save()}>Save</button>
      </div>
    </Sheet>
  );
}
