import { useId, useState } from 'react';
import type { Api } from '../../../api/client.ts';
import type { DeviceRow } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { Sheet } from '../../../components/Sheet.tsx';
import { useToast } from '../../../components/Toast.tsx';
import { deviceName, deviceStatus } from '../../../lib/settings.ts';
import './DevicesPanel.css';

interface Props {
  api: Api;
  /** deviceList() as the server has it now. */
  devices: DeviceRow[];
  reload: () => Promise<void>;
}

/** "Linked devices": each linked device with its state, and Remove (after a confirm). */
export function DevicesPanel({ api, devices, reload }: Props) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error } = useAction(reload);
  const [removing, setRemoving] = useState<DeviceRow | null>(null);

  const remove = async (device: DeviceRow) => {
    const done = await run(() => api.deviceRevoke(device.user_id));
    setRemoving(null);
    if (done !== undefined) toast.show('Device removed.');
  };

  return (
    <section className="panel settings-panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="settings-paneltitle">Linked devices</h2>
      {devices.length === 0 ? (
        <p className="settings-text">No devices yet. Link one with the code it shows, below.</p>
      ) : (
        <ul className="devices-list">
          {devices.map((d) => (
            <li key={d.user_id} className="settings-row devices-row" data-testid="device-row">
              <div className="settings-rowtext">
                <p className="devices-name">{deviceName(d)}</p>
                <p className="settings-rowsub">{deviceStatus(d)}</p>
              </div>
              <button
                type="button" className="btn" disabled={busy} aria-label={`Remove ${deviceName(d)}`}
                onClick={() => setRemoving(d)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error !== null && <p role="alert" className="settings-error">{errorText(error)}</p>}
      {removing && (
        <Sheet title="Remove this device?" onClose={() => setRemoving(null)}>
          <p className="settings-text">
            {deviceName(removing)} will show "Link this device" again. A parent can link it with a new code.
          </p>
          <div className="settings-buttons">
            <button type="button" className="btn" disabled={busy} onClick={() => setRemoving(null)}>Keep it</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void remove(removing)}>
              Remove
            </button>
          </div>
        </Sheet>
      )}
    </section>
  );
}
