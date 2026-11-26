import { useId, useRef, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { useToast } from '../../../components/Toast.tsx';
import { parentsLine, validEmail } from '../../../lib/settings.ts';
import './ParentsPanel.css';

interface Props {
  api: Api;
  /** getSettings().parent_emails: who may sign in as a parent. */
  emails: string[];
  /** The addresses of parents who have signed in. */
  signedIn: string[];
  /** The address of the parent using this screen; it can never be removed. */
  myEmail: string | null;
  reload: () => Promise<void>;
}

/** "Parents": the Google accounts allowed to sign in. Edit adds or removes addresses (not your own). */
export function ParentsPanel({ api, emails, signedIn, myEmail, reload }: Props) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error, clearError } = useAction(reload);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [adding, setAdding] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const me = myEmail?.toLowerCase() ?? null;
  const joined = new Set(signedIn.map((e) => e.toLowerCase()));
  const list = draft ?? emails;
  const removed = emails.filter((e) => !list.includes(e));

  const close = () => {
    setDraft(null);
    setAdding('');
    setProblem(null);
    clearError();
    window.setTimeout(() => editRef.current?.focus(), 0);
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const address = adding.trim().toLowerCase();
    if (!validEmail(address)) return setProblem('Type a whole e-mail address, like name@gmail.com.');
    if (list.includes(address)) return setProblem('That address is already on the list.');
    setProblem(null);
    setDraft([...list, address]);
    setAdding('');
  };

  const remove = (address: string) => {
    setDraft(list.filter((e) => e !== address));
    addRef.current?.focus();
  };

  const save = async () => {
    if (adding.trim() !== '') return setProblem('Press Add first, or clear the address.');
    const done = await run(() => api.updateSettings({ parent_emails: list }));
    if (done === undefined) return;
    toast.show('Parents saved.');
    close();
  };

  const message = problem ?? (error !== null ? errorText(error) : null);
  return (
    <section className="settings-section" aria-labelledby={`${id}-title`}>
      <div className="settings-row">
        <div className="settings-rowtext">
          <h2 id={`${id}-title`} className="settings-rowtitle">Parents</h2>
          <p className="settings-rowsub">{parentsLine(list.length)}</p>
        </div>
        {draft === null && (
          <button ref={editRef} type="button" className="btn" onClick={() => setDraft([...emails])}>Edit</button>
        )}
      </div>
      <ul className="parents-list" aria-label="Parent accounts">
        {list.map((address) => (
          <li key={address} className="parents-row">
            <div className="settings-rowtext">
              <p className="parents-email">{address}</p>
              <p className="settings-rowsub">
                {address === me ? 'You' : joined.has(address) ? 'Has signed in' : 'Not signed in yet'}
              </p>
            </div>
            {draft !== null && address !== me && (
              <button
                type="button" className="btn" disabled={busy} aria-label={`Remove ${address}`}
                onClick={() => remove(address)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {draft !== null && (
        <>
          <form className="parents-add" onSubmit={add} noValidate>
            <div className="settings-field parents-addfield">
              <label htmlFor={`${id}-add`}>Add a parent's Google address</label>
              <input
                ref={addRef} id={`${id}-add`} type="email" autoComplete="off" autoCapitalize="none" value={adding}
                autoFocus onChange={(e) => { setAdding(e.target.value); setProblem(null); }}
              />
            </div>
            <button type="submit" className="btn" disabled={busy}>Add</button>
          </form>
          {removed.length > 0 && (
            <p className="settings-text">When you save, {removed.join(', ')} can no longer sign in.</p>
          )}
          {message && <p role="alert" className="settings-error">{message}</p>}
          <div className="settings-buttons">
            <button type="button" className="btn" disabled={busy} onClick={close}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>Save</button>
          </div>
        </>
      )}
    </section>
  );
}
