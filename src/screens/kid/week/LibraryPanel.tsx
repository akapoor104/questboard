import { useId, useRef, useState } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Category, LibraryItem } from '../../../api/types.ts';
import { Icon } from '../../../components/Icon.tsx';
import { useToast } from '../../../components/Toast.tsx';
import { formatDuration } from '../../../lib/dates.ts';
import { filterLibrary } from '../../../lib/week.ts';
import './LibraryPanel.css';

export interface LibraryPanelProps {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  /** The Monday of the week cards are added to. */
  week: string;
  categories: Category[];
  items: LibraryItem[];
  /** `cat-<color>` for a category id. */
  colorClass: (categoryId: string) => string;
  /** The week is over: nothing can be added to it. */
  past: boolean;
  reload: () => Promise<void>;
  /** Opens the new-card form (with the category the filter shows, if any). */
  onNewCard: (categoryId: string | null) => void;
}

/** The Library: about 100 ideas, filtered by category. "Add" puts one in the week's stack. */
export function LibraryPanel(props: LibraryPanelProps) {
  const { api, childId, week, categories, items, colorClass, past, reload, onNewCard } = props;
  const id = useId();
  const toast = useToast();
  const [filter, setFilter] = useState<string | null>(null);
  /** Items being added right now: each Add is disabled until its own card is saved. */
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const pending = useRef(new Set<string>());     // the same, without waiting for a render
  const shown = filterLibrary(items, filter);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const add = async (item: LibraryItem) => {
    if (pending.current.has(item.id)) return;
    pending.current.add(item.id);
    setSaving((s) => new Set(s).add(item.id));
    try {
      await api.addCards(childId, [{
        title: item.title, category_id: item.category_id, minutes: item.minutes, place: 'week', week_start: week,
        library_item_id: item.id, details: item.description,
      }]);
      toast.show("Added to this week's stack");
    } catch (e) {
      toast.showError(e);
    } finally {
      await reload().catch(() => undefined);
      pending.current.delete(item.id);
      setSaving((s) => {
        const next = new Set(s);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <section id="library" className="panel library" aria-labelledby={`${id}-title`}>
      <div className="library-head">
        <h2 id={`${id}-title`}>Library</h2>
        <p className="library-hint">About 100 ideas from your plan. Add any card to this week, or make your own.</p>
        <button type="button" className="btn btn-primary library-new" disabled={past} onClick={() => onNewCard(filter)}>
          New card
        </button>
      </div>
      {past && <p className="library-past">This week is over. Go to this week to add cards.</p>}
      <div className="library-filters" role="group" aria-label="Show a category">
        <button type="button" className="library-filter" aria-pressed={filter === null} onClick={() => setFilter(null)}>
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id} type="button" className={`library-filter ${colorClass(c.id)}`} aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
          >
            <Icon name={c.icon} size={16} />{c.name}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="library-empty">No ideas here yet. Make your own with New card.</p> : (
        <ul className="library-grid">
          {shown.map((item) => {
            const cat = byId.get(item.category_id);
            return (
              <li key={item.id} className={`library-item ${colorClass(item.category_id)}`}>
                <div className="library-text">
                  <span className="library-title">{item.title}</span>
                  <span className="library-meta">
                    <Icon name={cat?.icon ?? 'star'} size={14} />
                    <span className="sr-only">{cat?.name ?? 'Other'},</span>
                    {formatDuration(item.minutes)}
                    {item.description && <span className="library-desc"> · {item.description}</span>}
                  </span>
                </div>
                <button
                  type="button" className="btn btn-small library-add" aria-label={`Add ${item.title}`}
                  disabled={past || saving.has(item.id)} onClick={() => void add(item)}
                >
                  Add
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
