import { useId, useState } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Closeout } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { Sheet } from '../../../components/Sheet.tsx';
import { useToast } from '../../../components/Toast.tsx';
import { closedToastText } from '../../../lib/today.ts';
import './CloseOutDialog.css';

const MOODS = ['Rough', 'Meh', 'OK', 'Good', 'Great'] as const;

export interface CloseOutDialogProps {
  api: Api;
  childId: string;
  /** Today's close-out when the day is already closed ("Change my note"), else null. */
  closeout: Closeout | null;
  /** Reloads the board and getToday(). */
  reload: () => Promise<void>;
  onClose: () => void;
}

/** "Close out today": an optional mood and note, then close the day. Saving again updates them. */
export function CloseOutDialog({ api, childId, closeout, reload, onClose }: CloseOutDialogProps) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error } = useAction(reload);
  const [mood, setMood] = useState<number | null>(closeout?.mood ?? null);
  const [note, setNote] = useState(closeout?.note ?? '');

  const save = async () => {
    const streak = await run(async () => {
      await api.closeDay(childId, { ...(mood === null ? {} : { mood }), note: note.trim() });
      // The campfire number is the server's, never counted here.
      return (await api.getToday(childId)).streak.current;
    });
    if (streak === undefined) return;
    toast.show(closeout ? 'Saved.' : closedToastText(streak));
    onClose();
  };

  return (
    <Sheet title="Close out today" onClose={onClose}>
      <div className="closeoutdialog-group">
        <h3 id={`${id}-mood`} className="closeoutdialog-label">How was today?</h3>
        <div className="closeoutdialog-moods" role="group" aria-labelledby={`${id}-mood`}>
          {MOODS.map((name, i) => (
            <button
              key={name} type="button" className="closeoutdialog-mood" aria-pressed={mood === i + 1}
              onClick={() => setMood(mood === i + 1 ? null : i + 1)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="closeoutdialog-group">
        <label htmlFor={`${id}-note`} className="closeoutdialog-label">
          One thing to remember <span className="muted">(optional)</span>
        </label>
        <input
          id={`${id}-note`} className="closeoutdialog-input" type="text" maxLength={500} value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error !== null && <p role="alert" className="closeoutdialog-error">{errorText(error)}</p>}
      <div className="closeoutdialog-buttons">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>Close the day</button>
      </div>
    </Sheet>
  );
}
