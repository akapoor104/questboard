import { useId, useRef, useState } from 'react';
import type { Api } from '../../../api/client.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { Sheet } from '../../../components/Sheet.tsx';
import { useToast } from '../../../components/Toast.tsx';
import './AutomationPanel.css';

interface Props {
  api: Api;
  /** getSettings().automation_token_set */
  tokenSet: boolean;
  reload: () => Promise<void>;
}

/**
 * "Weekly e-mail and Drive backup": makes the key the parents' Apps Script uses. The key is
 * shown once and kept only in this component; it is gone when the screen is left.
 */
export function AutomationPanel({ api, tokenSet, reload }: Props) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error } = useAction(reload);
  const [confirming, setConfirming] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  const make = async () => {
    setConfirming(false);
    const result = await run(() => api.rotateAutomationToken());
    if (result === undefined) return;
    setToken(result.token);
    window.setTimeout(() => tokenRef.current?.focus(), 0);
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast.show('Key copied.');
    } catch {
      tokenRef.current?.select();
      toast.show('Select the key and copy it.');
    }
  };

  return (
    <section className="settings-section" aria-labelledby={`${id}-title`}>
      <div className="settings-row">
        <div className="settings-rowtext">
          <h2 id={`${id}-title`} className="settings-rowtitle">Weekly e-mail and Drive backup</h2>
          <p className="settings-rowsub">Sundays, from your own Google account.</p>
          <p className="settings-rowsub" data-testid="token-status">{tokenSet ? 'Key created' : 'No key yet'}</p>
        </div>
        <button
          type="button" className="btn" disabled={busy}
          onClick={() => (tokenSet ? setConfirming(true) : void make())}
        >
          New key
        </button>
      </div>
      {token !== null && (
        <div className="automation-token">
          <div className="settings-field">
            <label htmlFor={`${id}-token`}>Your new key</label>
            <div className="automation-tokenrow">
              <input
                ref={tokenRef} id={`${id}-token`} className="automation-tokenvalue" type="text" readOnly value={token}
                data-testid="token-value" autoComplete="off" spellCheck={false} onFocus={(e) => e.target.select()}
              />
              <button type="button" className="btn" onClick={() => void copy()}>Copy</button>
            </div>
          </div>
          <p className="settings-text">This replaces the old key. It is shown only once.</p>
        </div>
      )}
      <p className="settings-text automation-steps">Setup steps: part 7 of the setup guide.</p>
      {error !== null && <p role="alert" className="settings-error">{errorText(error)}</p>}
      {confirming && (
        <Sheet title="Make a new key?" onClose={() => setConfirming(false)}>
          <p className="settings-text">This replaces the old key. The weekly e-mail stops until you paste the new one.</p>
          <div className="settings-buttons">
            <button type="button" className="btn" onClick={() => setConfirming(false)}>Keep the old key</button>
            <button type="button" className="btn btn-primary" onClick={() => void make()}>Make a new key</button>
          </div>
        </Sheet>
      )}
    </section>
  );
}
