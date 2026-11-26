import { Link } from 'react-router-dom';
import type { Api } from '../api/client.ts';
import type { ChildSummary } from '../api/types.ts';
import { errorText } from '../app/errors.ts';
import { useAction } from '../app/useLoad.ts';
import { AVATAR_ICONS } from '../ui/icons.ts';
import { Icon } from './Icon.tsx';
import { Sheet } from './Sheet.tsx';
import './ProfileSheet.css';

export interface ProfileSheetProps {
  api: Api;
  child: ChildSummary;
  /** Asks the server who this device is again, so the new avatar and theme show. */
  reload: () => Promise<void>;
  onClose: () => void;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "My profile": his avatar and the light or dark theme, and the way to the parent side. */
export function ProfileSheet({ api, child, reload, onClose }: ProfileSheetProps) {
  const { run, busy, error } = useAction(reload);
  const dark = child.theme === 'dark';

  return (
    <Sheet title="My profile" onClose={onClose}>
      <div className="profile-group">
        <h3 id="profile-avatar" className="profile-label">Avatar</h3>
        <div className="profile-avatars" role="group" aria-labelledby="profile-avatar">
          {AVATAR_ICONS.map((key) => (
            <button
              key={key} type="button" className="profile-avatar cat-violet" aria-label={capital(key)}
              aria-pressed={child.avatar === key} disabled={busy}
              onClick={() => void run(() => api.updateChild(child.id, { avatar: key }))}
            >
              <Icon name={key} size={26} />
            </button>
          ))}
        </div>
      </div>
      <div className="profile-group">
        <h3 id="profile-theme" className="profile-label">Theme</h3>
        <div className="profile-themes" role="group" aria-labelledby="profile-theme">
          {(['light', 'dark'] as const).map((theme) => (
            <button
              key={theme} type="button" className="profile-theme" aria-pressed={(theme === 'dark') === dark}
              disabled={busy} onClick={() => void run(() => api.updateChild(child.id, { theme }))}
            >
              {capital(theme)}
            </button>
          ))}
        </div>
      </div>
      {error !== null && <p role="alert" className="profile-error">{errorText(error)}</p>}
      <Link to="/parent" className="profile-parent">Parent sign-in</Link>
    </Sheet>
  );
}
