import { useId, useRef, useState, type ChangeEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import type { ExportDoc } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { Sheet } from '../../../components/Sheet.tsx';
import { useToast } from '../../../components/Toast.tsx';
import { backupFileName, backupSummary, parseBackup } from '../../../lib/settings.ts';
import './BackupPanel.css';

interface Props {
  api: Api;
  /** The family's today, for the file name. */
  today: string;
  timeZone: string;
  /** Reloads everything on the screen after the board was replaced. */
  onRestored: () => Promise<void>;
}

const NOT_A_BACKUP = 'That file is not a Questboard backup.';
const nothing = async () => {};

/** "Backup and moving": download the whole board as one file, or replace the board with one. */
export function BackupPanel({ api, today, timeZone, onRestored }: Props) {
  const id = useId();
  const toast = useToast();
  const exporting = useAction(nothing);
  const importing = useAction(onRestored);
  const fileRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [chosen, setChosen] = useState<ExportDoc | null>(null);
  const [typed, setTyped] = useState('');

  const download = async () => {
    setProblem(null);
    const doc = await exporting.run(() => api.exportData());
    if (doc === undefined) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName(today);
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';                      // so the same file can be chosen again
    if (!file) return;
    setProblem(null);
    try {
      setChosen(parseBackup(await file.text()));
      setTyped('');
    } catch {
      setProblem(NOT_A_BACKUP);
    }
  };

  const close = () => {
    setChosen(null);
    setTyped('');
    importing.clearError();
  };

  const restore = async () => {
    if (!chosen || typed.trim() !== 'RESTORE') return;
    const done = await importing.run(() => api.importData(chosen));
    if (done === undefined) return;
    close();
    toast.show('Board restored.');
  };

  const busy = exporting.busy || importing.busy;
  const message = problem ?? (exporting.error !== null ? errorText(exporting.error) : null);
  return (
    <section className="panel settings-panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="settings-paneltitle">Backup and moving</h2>
      <p className="settings-text">One file holds the whole board. Use it to restore, or to move to a new home.</p>
      <div className="settings-buttons">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void download()}>
          Download a backup
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          Restore from a backup
        </button>
      </div>
      <input
        ref={fileRef} className="backup-file" type="file" accept="application/json,.json" tabIndex={-1}
        aria-label="Backup file" onChange={(e) => void pick(e)}
      />
      {message && <p role="alert" className="settings-error">{message}</p>}
      {chosen && (
        <Sheet title="Restore from a backup" onClose={close}>
          <p className="backup-summary" data-testid="backup-summary">{backupSummary(chosen, timeZone)}</p>
          <p className="settings-text">This replaces everything on the board.</p>
          <form className="backup-confirm" onSubmit={(e) => { e.preventDefault(); void restore(); }}>
            <div className="settings-field">
              <label htmlFor={`${id}-confirm`}>Type RESTORE to confirm</label>
              <input
                id={`${id}-confirm`} type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                value={typed} onChange={(e) => setTyped(e.target.value)}
              />
            </div>
            {importing.error !== null && <p role="alert" className="settings-error">{errorText(importing.error)}</p>}
            <div className="settings-buttons">
              <button type="button" className="btn" disabled={importing.busy} onClick={close}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={importing.busy || typed.trim() !== 'RESTORE'}>
                Restore
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </section>
  );
}
