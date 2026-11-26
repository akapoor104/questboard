import { Fragment, useState } from 'react';
import { errorText } from '../../app/errors.ts';
import { resetDemo } from '../../app/connection.ts';
import { useParentChild, useSession } from '../../app/session.tsx';
import { useLoad } from '../../app/useLoad.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { useToast } from '../../components/Toast.tsx';
import { familyForm } from '../../lib/settings.ts';
import { AutomationPanel } from './settings/AutomationPanel.tsx';
import { BackupPanel } from './settings/BackupPanel.tsx';
import { DevicesPanel } from './settings/DevicesPanel.tsx';
import { FamilyPanel } from './settings/FamilyPanel.tsx';
import { LinkDevicePanel } from './settings/LinkDevicePanel.tsx';
import { ParentsPanel } from './settings/ParentsPanel.tsx';
import { PinPanel } from './settings/PinPanel.tsx';
import './Settings.css';

/** Parent: Settings. Devices, the PIN, the parents, the automation key, backups and the family. */
export function Settings() {
  const { conn, parentApi, parentMe, refreshParent } = useSession();
  if (!parentMe) throw new Error('Settings needs a signed-in parent');
  const child = useParentChild();
  const { showError } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  /** Bumped after a restore so every panel starts again from what the server has now. */
  const [generation, setGeneration] = useState(0);

  const settings = useLoad(() => parentApi.getSettings(), []);
  const devices = useLoad(() => parentApi.deviceList(), []);
  const loads = [settings, devices];
  const failed = loads.find((l) => l.error);
  const reloadAll = async () => { await Promise.all(loads.map((l) => l.reload())); };

  const afterRestore = async () => {
    await reloadAll();
    await refreshParent().catch(() => null);
    setGeneration((n) => n + 1);
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await conn.signOutParent();
      await refreshParent();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  const head = (
    <div className="settings-head">
      <h1 className="settings-title">Settings</h1>
      <p className="settings-sub">Signed in with Google as {parentMe.email ?? 'a parent'}</p>
    </div>
  );
  const errorPanel = failed && (
    <div className="panel page-actions">
      <p role="alert" className="page-error">{errorText(failed.error)}</p>
      <button type="button" className="btn" onClick={() => void reloadAll()}>Try again</button>
    </div>
  );
  if (!settings.data || !devices.data) return <>{head}{errorPanel || <p className="muted">Loading...</p>}</>;

  const s = settings.data;
  const pinSet = s.children.find((c) => c.id === child.id)?.pin_set ?? child.pin_set ?? false;

  return (
    <>
      {head}
      {errorPanel}
      <Fragment key={generation}>
        <DevicesPanel api={parentApi} devices={devices.data} reload={devices.reload} />
        <LinkDevicePanel api={parentApi} childId={child.id} role="parent" reload={devices.reload} />
        <div className="panel settings-group">
          <PinPanel
            api={parentApi} childId={child.id} role="parent" childName={child.name} pinSet={pinSet} reload={reloadAll}
          />
          <ParentsPanel
            api={parentApi} emails={s.parent_emails ?? []} signedIn={(s.parents ?? []).map((p) => p.email)}
            myEmail={parentMe.email} reload={settings.reload}
          />
          <AutomationPanel api={parentApi} tokenSet={s.automation_token_set ?? false} reload={settings.reload} />
        </div>
        <BackupPanel api={parentApi} today={parentMe.today} timeZone={s.timezone} onRestored={afterRestore} />
        <FamilyPanel
          key={JSON.stringify(familyForm(s))} api={parentApi} settings={s}
          reload={async () => { await settings.reload(); await refreshParent().catch(() => null); }}
        />
      </Fragment>
      <div className="settings-end">
        <button type="button" className="btn" disabled={busy} onClick={() => void signOut()}>Sign out</button>
        {conn.mode === 'demo' && (
          <button type="button" className="btn" onClick={() => setConfirmReset(true)}>Reset the demo</button>
        )}
      </div>
      {confirmReset && (
        <Sheet title="Reset the demo?" onClose={() => setConfirmReset(false)}>
          <p className="settings-text">Everything in this demo goes back to how it started. The PIN is 1234 again.</p>
          <div className="settings-buttons">
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>Keep it</button>
            <button type="button" className="btn btn-primary" onClick={() => resetDemo()}>Reset</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
