import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { errorText } from '../app/errors.ts';
import { Icon } from './Icon.tsx';
import './Toast.css';

export interface Toaster {
  /**
   * One line about a result. Disappears after 4 seconds, or 8 with an action
   * (one button, such as "Undo", that also closes the toast).
   */
  show(text: string, action?: ToastAction): void;
  /** errorText(err) in role="alert". Stays until dismissed. */
  showError(err: unknown): void;
}

export interface ToastAction {
  label: string;
  onPress: () => void;
}

const ToastContext = createContext<Toaster | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<{ text: string; action?: ToastAction; n: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const show = useCallback(
    (text: string, action?: ToastAction) => setNote((old) => ({ text, action, n: (old?.n ?? 0) + 1 })), []);
  const showError = useCallback((err: unknown) => setProblem(errorText(err)), []);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), note.action ? 8000 : 4000);
    return () => window.clearTimeout(timer);
  }, [note]);

  const value = useMemo<Toaster>(() => ({ show, showError }), [show, showError]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-area">
        <div aria-live="polite" className="toast-live">
          {note && !note.action && <p className="toast">{note.text}</p>}
          {note?.action && (
            <div className="toast toast-with-action">
              <span>{note.text}</span>
              <button
                type="button" className="toast-action"
                onClick={() => { const a = note.action; setNote(null); a?.onPress(); }}
              >
                {note.action.label}
              </button>
            </div>
          )}
        </div>
        {problem && (
          <div role="alert" className="toast toast-error">
            <span>{problem}</span>
            <button type="button" className="toast-dismiss" aria-label="Dismiss" onClick={() => setProblem(null)}>
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Toaster {
  const t = useContext(ToastContext);
  if (!t) throw new Error('useToast must be used inside <ToastProvider>');
  return t;
}
