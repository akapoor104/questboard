import { useId, useRef, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { useToast } from '../../../components/Toast.tsx';
import { validPin } from '../../../lib/settings.ts';
import './PinPanel.css';

interface Props {
  api: Api;
  childId: string;
  role: 'parent';
  childName: string;
  pinSet: boolean;
  reload: () => Promise<void>;
}

/** "{name}'s PIN": set or change it. The PIN is only held while it is typed; never after saving. */
export function PinPanel({ api, childId, childName, pinSet, reload }: Props) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error, clearError } = useAction(reload);
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setPin('');
    setAgain('');
    setProblem(null);
    clearError();
    setOpen(false);
    window.setTimeout(() => openRef.current?.focus(), 0);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validPin(pin)) return setProblem('The PIN is four digits.');
    if (pin !== again) return setProblem('The two PINs are not the same. Type them again.');
    setProblem(null);
    const done = await run(() => api.setChildPin(childId, pin));
    if (done === undefined) return;
    toast.show('PIN changed. His devices are locked.');
    close();
  };

  const message = problem ?? (error !== null ? errorText(error) : null);
  return (
    <section className="settings-section" aria-labelledby={`${id}-title`}>
      <div className="settings-row">
        <div className="settings-rowtext">
          <h2 id={`${id}-title`} className="settings-rowtitle">{childName}'s PIN</h2>
          <p className="settings-rowsub">{pinSet ? 'Set. Changing it locks all his devices.' : 'Not set yet.'}</p>
        </div>
        {!open && (
          <button ref={openRef} type="button" className="btn" onClick={() => setOpen(true)}>
            {pinSet ? 'Change' : 'Set a PIN'}
          </button>
        )}
      </div>
      {open && (
        <form className="pin-form" onSubmit={(e) => void save(e)}>
          <div className="settings-field">
            <label htmlFor={`${id}-pin`}>New PIN (4 digits)</label>
            <input
              id={`${id}-pin`} type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin}
              autoFocus onChange={(e) => { setPin(e.target.value.replace(/[^0-9]/g, '')); setProblem(null); }}
            />
          </div>
          <div className="settings-field">
            <label htmlFor={`${id}-again`}>Type it again</label>
            <input
              id={`${id}-again`} type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={again}
              onChange={(e) => { setAgain(e.target.value.replace(/[^0-9]/g, '')); setProblem(null); }}
            />
          </div>
          {message && <p role="alert" className="settings-error">{message}</p>}
          <div className="settings-buttons">
            <button type="button" className="btn" disabled={busy} onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save PIN</button>
          </div>
        </form>
      )}
    </section>
  );
}
