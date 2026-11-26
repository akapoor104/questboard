import { closeOutText } from '../../../lib/today.ts';

interface Props {
  /** Today's cards that still need a percent. */
  open: number;
  closed: boolean;
  /** Opens the close-out dialog (to close the day, or to change the note). */
  onOpen: () => void;
}

/** Close out the day: allowed once every card of today has a percent. */
export function CloseOutPanel({ open, closed, onOpen }: Props) {
  return (
    <section className="panel closeout" aria-labelledby="closeout-title">
      <h2 id="closeout-title" className="closeout-title">Close out the day</h2>
      {closed ? (
        <>
          <p className="today-hint">Today is closed out.</p>
          <button type="button" className="btn" onClick={onOpen}>Change my note</button>
        </>
      ) : (
        <>
          <p className="today-hint">{closeOutText(open)}</p>
          <button type="button" className="btn btn-primary" disabled={open > 0} onClick={onOpen}>Close out today</button>
        </>
      )}
    </section>
  );
}
