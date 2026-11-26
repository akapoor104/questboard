import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { errorText } from '../app/errors.ts';
import { Icon } from './Icon.tsx';
import './Toast.css';

export interface Toaster {
  /** One line about a result. Disappears after 4 seconds. */
  show(text: string): void;
  /** errorText(err) in role="alert". Stays until dismissed. */
  showError(err: unknown): void;
}

const ToastContext = createContext<Toaster | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<{ text: string; n: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const show = useCallback((text: string) => setNote((old) => ({ text, n: (old?.n ?? 0) + 1 })), []);
  const showError = useCallback((err: unknown) => setProblem(errorText(err)), []);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(timer);
  }, [note]);

  const value = useMemo<Toaster>(() => ({ show, showError }), [show, showError]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-area">
        <div aria-live="polite" className="toast-live">
          {note && <p className="toast">{note.text}</p>}
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
