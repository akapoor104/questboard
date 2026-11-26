import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { errorText } from '../app/errors.ts';
import { useSession } from '../app/session.tsx';
import { Icon } from '../components/Icon.tsx';
import { pinMessage } from '../lib/pin.ts';
import './Unlock.css';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * The PIN pad. The digits live only in this component's state; the server checks them.
 * No <input>, so a tablet shows no keyboard and no browser offers to save the PIN.
 */
export function Unlock() {
  const { conn, api, me, refreshMe } = useSession();
  const child = me?.children[0];
  const [digits, setDigits] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const locked = lockedUntil !== null;

  const press = (d: string) => setDigits((cur) => (cur.length >= PIN_LENGTH ? cur : cur + d));
  const erase = () => setDigits((cur) => cur.slice(0, -1));

  // The fourth digit sends the PIN, then the pad clears.
  useEffect(() => {
    if (digits.length < PIN_LENGTH) return;
    const pin = digits;
    void (async () => {
      try {
        const result = await api.kidUnlock(pin);
        setDigits('');
        if (result.ok) {
          setMessage(null);
          await refreshMe();      // the gate now shows his board
          return;
        }
        setMessage(pinMessage(result, me?.timezone ?? 'UTC'));
        if (result.locked_until) setLockedUntil(Date.parse(result.locked_until));
      } catch (e) {
        setDigits('');
        setMessage(errorText(e));   // pin_not_set: "Ask a parent to set your PIN."
      }
    })();
  }, [digits, api, refreshMe, me?.timezone]);

  // While locked out the pad is disabled; it opens again when the time has passed.
  useEffect(() => {
    if (lockedUntil === null) return;
    const open = () => { setLockedUntil(null); setMessage(null); };
    const wait = lockedUntil - Date.now();
    if (wait <= 0) { open(); return; }
    const timer = window.setTimeout(open, wait);
    return () => window.clearTimeout(timer);
  }, [lockedUntil]);

  // Keyboard: digits type, Backspace deletes.
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key >= '0' && e.key <= '9' && e.key.length === 1) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); erase(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked]);

  const label = me?.device?.label;
  return (
    <main className="page page-narrow unlock">
      {conn.mode === 'demo' && <div className="unlock-demo"><span className="demo-badge" data-testid="demo-badge">Demo</span></div>}
      <div className="unlock-brand">
        <Icon name="d20" size={24} />
        <span>Questboard</span>
      </div>
      <div className="unlock-hello">
        <div className="unlock-avatar"><Icon name={child?.avatar ?? 'd20'} size={44} /></div>
        <h1 className="unlock-title">Hi, {child?.name ?? ''}</h1>
        <p className="unlock-hint">Enter your PIN to open your board.</p>
      </div>

      <div className="unlock-dots" role="group" aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={i < digits.length ? 'unlock-dot unlock-dot-on' : 'unlock-dot'} />
        ))}
      </div>

      <div className="unlock-pad">
        {KEYS.map((k) => (
          <button key={k} type="button" className="unlock-key" disabled={locked} onClick={() => press(k)}>{k}</button>
        ))}
        <span />
        <button type="button" className="unlock-key" disabled={locked} onClick={() => press('0')}>0</button>
        <button type="button" className="unlock-key unlock-key-delete" aria-label="Delete" disabled={locked} onClick={erase}>
          <Icon name="backspace" size={26} />
        </button>
      </div>

      <div className="unlock-message">
        {message
          ? <p role="alert" className="unlock-alert">{message}</p>
          : <p className="unlock-note">Five wrong tries lock the board for five minutes. A parent can reset your PIN.</p>}
      </div>

      <footer className="unlock-footer">
        <span>{label ? `This device: ${label}` : ''}</span>
        <RouterLink to="/parent" className="unlock-parent">Parent sign-in</RouterLink>
      </footer>
    </main>
  );
}
