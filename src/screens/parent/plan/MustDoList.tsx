import { useId } from 'react';
import type { Categories } from '../../../app/useCategories.ts';
import { Icon } from '../../../components/Icon.tsx';
import type { MustGroup } from '../../../lib/board.ts';
import { groupKey, mustDoMeta, mustDoStatus } from '../../../lib/parentPlan.ts';
import './MustDoList.css';

interface Props {
  groups: MustGroup[];
  cats: Categories;
  onAdd: () => void;
  onOpen: (group: MustGroup) => void;
}

/** "Must-dos this week": one row per group of the same must-do, and "Add a must-do". */
export function MustDoList({ groups, cats, onAdd, onOpen }: Props) {
  const id = useId();
  return (
    <section className="panel mustdolist" aria-labelledby={`${id}-title`}>
      <div className="mustdolist-head">
        <h2 id={`${id}-title`} className="mustdolist-title">Must-dos this week</h2>
        <button type="button" className="btn btn-primary" onClick={onAdd}>Add a must-do</button>
      </div>
      {groups.length === 0 ? (
        <p className="muted mustdolist-empty">No must-dos this week yet. Add the few that matter.</p>
      ) : (
        <ul className="mustdolist-rows">
          {groups.map((g) => {
            const cat = cats.byId.get(g.category_id);
            return (
              <li key={groupKey(g)} className={cats.colorClass(g.category_id)} data-testid="mustdo-row">
                <button type="button" className="mustdolist-row" onClick={() => onOpen(g)}>
                  <span className="mustdolist-cat">
                    <Icon name={cat?.icon ?? 'star'} size={16} />
                    <span className="sr-only">{cat?.name ?? 'Other'}:</span>
                  </span>
                  <span className="mustdolist-text">
                    <span className="mustdolist-name">{g.title}</span>
                    <span className="mustdolist-meta">{mustDoMeta(g)}</span>
                  </span>
                  <span className="mustdolist-status">{mustDoStatus(g)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
