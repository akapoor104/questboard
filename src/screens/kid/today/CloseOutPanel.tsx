import { closeOutText } from '../../../lib/today.ts';

interface Props {
  /** Today's cards that still need a percent. */
  open: number;
  closed: boolean;
}

/** Close out the day. The buttons work from T06. */
export function CloseOutPanel({ open, closed }: Props) {
  return (
    <section className="panel closeout" aria-labelledby="closeout-title">
      <h2 id="closeout-title" className="closeout-title">Close out the day</h2>
      {closed ? (
        <>
          <p className="today-hint">Today is closed out.</p>
          <button type="button" className="btn">Change my note</button>
        </>
      ) : (
        <>
          <p className="today-hint">{closeOutText(open)}</p>
          <button type="button" className="btn btn-primary" disabled>Close out today</button>
        </>
      )}
    </section>
  );
}
