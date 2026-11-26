import { useId } from 'react';
import { formatDuration } from '../../../lib/dates.ts';
import { loadState, loadText } from '../../../lib/week.ts';
import './LoadMeter.css';

interface Props {
  /** Structured minutes planned this week: on its days and in its stack. */
  plannedMin: number;
  /** The family's weekly guide, `structured_weekly_max_min`. */
  guideMin: number;
}

/** "Is this week too full?": structured time against the weekly guide. It informs; it never blocks. */
export function LoadMeter({ plannedMin, guideMin }: Props) {
  const id = useId();
  const state = loadState(plannedMin, guideMin);
  const width = Math.min(1, state.ratio) * 100;
  return (
    <section className="panel loadmeter" aria-labelledby={`${id}-title`} data-level={state.level}>
      <h2 id={`${id}-title`} className="loadmeter-title">Is this week too full?</h2>
      <p className="loadmeter-text">
        Structured time planned: {formatDuration(plannedMin)} of a {formatDuration(guideMin)} weekly guide.
        Fun, rest and outdoors do not count.
      </p>
      <div
        className="loadmeter-track" role="meter" data-testid="load-meter" aria-label="Structured time planned"
        aria-valuemin={0} aria-valuemax={guideMin} aria-valuenow={plannedMin}
        aria-valuetext={`${formatDuration(plannedMin)} of ${formatDuration(guideMin)}`}
      >
        <div className="loadmeter-fill" style={{ width: `${width}%` }} />
      </div>
      <p className="loadmeter-verdict">{loadText(state)}</p>
    </section>
  );
}
