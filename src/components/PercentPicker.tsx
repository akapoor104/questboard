import { useId } from 'react';
import { resolveText } from '../lib/cardActions.ts';
import './PercentPicker.css';

const CHOICES = [
  { pct: 0, word: 'Not started' },
  { pct: 25, word: 'A little' },
  { pct: 50, word: 'Half' },
  { pct: 75, word: 'Most' },
  { pct: 100, word: 'Done' },
];

export interface PercentPickerProps {
  /** The card's planned minutes, for the preview line. */
  minutes: number;
  /** Null until he picks one. */
  value: number | null;
  onChange: (pct: number) => void;
  disabled?: boolean;
}

/** The five percent buttons and the live preview ("About 23 min done. 25 min left over."). */
export function PercentPicker({ minutes, value, onChange, disabled }: PercentPickerProps) {
  const id = useId();
  const preview = value === null ? null : resolveText(minutes, value);
  return (
    <div className="percent">
      <h3 id={`${id}-label`} className="percent-label">How much did you get done?</h3>
      <div className="percent-row" role="group" aria-labelledby={`${id}-label`}>
        {CHOICES.map(({ pct, word }) => (
          <button
            key={pct} type="button" className="percent-btn" aria-pressed={value === pct}
            aria-describedby={`${id}-w${pct}`} disabled={disabled} onClick={() => onChange(pct)}
          >
            <span className="percent-num">{pct}%</span>
            <span id={`${id}-w${pct}`} className="percent-word" aria-hidden="true">{word}</span>
          </button>
        ))}
      </div>
      <p className="percent-preview" aria-live="polite" data-testid="resolve-preview">
        {preview ? (
          <>
            <span className="percent-done">{preview.done}</span>{' '}
            <span className="percent-left">{preview.left}</span>
          </>
        ) : <span className="percent-left">Pick how much you did.</span>}
      </p>
    </div>
  );
}
