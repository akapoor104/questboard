import type { Category } from '../api/types.ts';
import { formatDuration } from '../lib/dates.ts';
import { Icon } from './Icon.tsx';
import './CategoryBar.css';

export interface CategoryBarProps {
  category: Category;
  /** `cat-<color>` for the category (from useCategories().colorClass). */
  colorClass: string;
  plannedMin: number;
  spentMin: number;
  /** The widest bar's planned minutes: every bar is drawn against it. */
  scaleMin: number;
}

/** One category's time: icon and name, a bar (solid = spent, pale = planned) and "4 h 15 min of 5 h". */
export function CategoryBar({ category, colorClass, plannedMin, spentMin, scaleMin }: CategoryBarProps) {
  const scale = Math.max(scaleMin, plannedMin, spentMin, 1);
  const track = Math.max(plannedMin, spentMin);
  const trackPct = (track / scale) * 100;
  const fillPct = track > 0 ? (spentMin / track) * 100 : 0;
  return (
    <div className={`catbar ${colorClass}`}>
      <span className="catbar-name">
        <span className="catbar-icon"><Icon name={category.icon} size={16} /></span>
        {category.name}
      </span>
      <span className="catbar-area" aria-hidden="true">
        <span className="bar-track catbar-track" style={{ width: `${trackPct}%` }}>
          <span className="bar-fill catbar-fill" style={{ width: `${fillPct}%` }} />
        </span>
      </span>
      <span className="catbar-text">{formatDuration(spentMin)} of {formatDuration(plannedMin)}</span>
    </div>
  );
}
