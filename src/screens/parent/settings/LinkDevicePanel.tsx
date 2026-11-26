import { useId, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { useToast } from '../../../components/Toast.tsx';
import { cleanPairCode } from '../../../lib/settings.ts';
import './LinkDevicePanel.css';

interface Props {
  api: Api;
  childId: string;
  role: 'parent';
  /** Reloads the list of linked devices. */
  reload: () => Promise<void>;
}

/** 'ABCD' -> 'ABC-D': the code as it is shown while typing. */
function shown(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

/** "Link a new device": the six-letter code a device shows, his device or a display, and a name. */
export function LinkDevicePanel({ api, childId, reload }: Props) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error, clearError } = useAction(reload);
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'kid' | 'display'>('kid');
  const [label, setLabel] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const link = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (code.length !== 6) {
      setProblem('The code has six letters and numbers.');
      return;
    }
    setProblem(null);
    const done = await run(() => api.deviceApprove(code, childId, kind, label.trim() || undefined));
    if (done === undefined) return;
    setCode('');
    setKind('kid');
    setLabel('');
    toast.show('Device linked.');
  };

  const message = problem ?? (error !== null ? errorText(error) : null);
  return (
    <section className="panel settings-panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="settings-paneltitle">Link a new device</h2>
      <p className="settings-text">Open Questboard on the device and type the six-letter code it shows.</p>
      <form className="linkdevice-form" onSubmit={(e) => void link(e)}>
        <div className="linkdevice-coderow">
          <label htmlFor={`${id}-code`} className="sr-only">Code</label>
          <input
            id={`${id}-code`} className="linkdevice-code" type="text" value={shown(code)} maxLength={7}
            autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} inputMode="text"
            placeholder="Code" aria-describedby={message ? `${id}-error` : undefined}
            onChange={(e) => { setCode(cleanPairCode(e.target.value)); setProblem(null); }}
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>Link</button>
        </div>
        <fieldset className="linkdevice-kinds">
          <legend className="sr-only">What kind of device</legend>
          <label className="linkdevice-kind">
            <input type="radio" name={`${id}-kind`} checked={kind === 'kid'} onChange={() => setKind('kid')} />
            His device
          </label>
          <label className="linkdevice-kind">
            <input type="radio" name={`${id}-kind`} checked={kind === 'display'} onChange={() => setKind('display')} />
            Display only
          </label>
        </fieldset>
        <div className="settings-field">
          <label htmlFor={`${id}-label`}>Name for this device (optional)</label>
          <input
            id={`${id}-label`} type="text" maxLength={60} value={label} autoComplete="off"
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </form>
      {message && <p id={`${id}-error`} role="alert" className="settings-error">{message}</p>}
    </section>
  );
}
