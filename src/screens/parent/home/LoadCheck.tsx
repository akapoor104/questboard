import { useId } from 'react';
import { loadCheckText } from '../../../lib/parentHome.ts';
import './LoadCheck.css';

interface Props {
  /** `totals.structured_planned_min` for the week. */
  plannedMin: number;
  /** `structured_weekly_max_min`: the parents' weekly guide. */
  guideMin: number;
}

/** "Load check": structured time planned against the weekly guide, in one sentence. */
export function LoadCheck({ plannedMin, guideMin }: Props) {
  const id = useId();
  return (
    <section className="panel loadcheck" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="loadcheck-title">Load check</h2>
      <p className="loadcheck-text">{loadCheckText(plannedMin, guideMin)}</p>
    </section>
  );
}
