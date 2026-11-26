import { useId } from 'react';
import type { Goal } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { Icon } from '../../../components/Icon.tsx';
import './FocusChips.css';

interface Props {
  /** The week's focus goals (active and done), from weekFocus(). */
  goals: Goal[];
  cats: Categories;
  onEdit: () => void;
}

/** "This week's focus": one chip per goal; done ones struck through. */
export function FocusChips({ goals, cats, onEdit }: Props) {
  const id = useId();
  return (
    <div className="focuschips">
      <h2 id={`${id}-label`} className="label focuschips-label">This week's focus</h2>
      <div className="focuschips-row">
        {goals.length === 0 && <p className="muted focuschips-empty">No focus yet. Pick up to three.</p>}
        {goals.length > 0 && (
          <ul className="focuschips-list" aria-labelledby={`${id}-label`}>
            {goals.map((g) => {
              const cat = g.category_id ? cats.byId.get(g.category_id) : undefined;
              const done = g.status === 'done';
              return (
                <li
                  key={g.id} className={`chip focuschips-chip ${g.category_id ? cats.colorClass(g.category_id) : 'cat-slate'}`}
                  data-status={g.status}
                >
                  <Icon name={done ? 'check' : cat?.icon ?? 'star'} size={16} />
                  {cat && <span className="sr-only">{cat.name}:</span>}
                  <span className="focuschips-title">{g.title}</span>
                  {done && <span className="sr-only">(done)</span>}
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="btn btn-small" onClick={onEdit}>
          <Icon name="edit" size={16} />Edit focus
        </button>
      </div>
    </div>
  );
}
