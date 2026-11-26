import { useId } from 'react';
import type { Stats } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { CategoryBar } from '../../../components/CategoryBar.tsx';
import { monthDay } from '../../../lib/month.ts';
import './TimeByCategory.css';

interface Props {
  /** Stats from the first of the month to today (or the month's end). */
  stats: Stats;
  cats: Categories;
}

/** "Where my time went": one bar per category with planned time, in category order. */
export function TimeByCategory({ stats, cats }: Props) {
  const id = useId();
  const rows = cats.categories
    .map((c) => ({ category: c, row: stats.by_category.find((r) => r.category_id === c.id) }))
    .filter((x) => x.row && x.row.planned_min > 0)
    .map((x) => ({ category: x.category, planned: x.row!.planned_min, spent: x.row!.spent_min }));
  const scale = Math.max(0, ...rows.map((r) => r.planned));
  const range = stats.from === stats.to ? monthDay(stats.from) : `${monthDay(stats.from)} to ${monthDay(stats.to)}`;

  return (
    <section className="panel timebycat" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="timebycat-title">Where my time went</h2>
      <p className="timebycat-hint">{range}. Solid is time spent; pale is time planned.</p>
      {rows.length === 0 ? (
        <p className="muted">Nothing planned yet. Cards you add to a day show up here.</p>
      ) : (
        <ul className="timebycat-list">
          {rows.map((r) => (
            <li key={r.category.id}>
              <CategoryBar
                category={r.category} colorClass={cats.colorClass(r.category.id)} plannedMin={r.planned}
                spentMin={r.spent} scaleMin={scale}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
