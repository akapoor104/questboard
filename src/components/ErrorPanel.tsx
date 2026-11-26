import { errorText } from '../app/errors.ts';

interface Props {
  /** The error a load or a change ended with: any value, usually an ApiError. */
  error: unknown;
  /** Loads again ("Try again"). */
  onRetry: () => void;
  /** Extra class names for the panel (for example a grid placement). */
  className?: string;
}

/** The error state of a screen: the friendly sentence and a "Try again" button. */
export function ErrorPanel({ error, onRetry, className }: Props) {
  return (
    <div className={`panel page-actions${className ? ` ${className}` : ''}`} data-testid="error-panel">
      <p role="alert" className="page-error">{errorText(error)}</p>
      <button type="button" className="btn" onClick={onRetry}>Try again</button>
    </div>
  );
}
